import { randomUUID } from 'crypto';
import LeadIngestionEvent from '../../models/integrations/LeadIngestionEvent.js';
import MetaFormMapping from '../../models/integrations/MetaFormMapping.js';
import Customer from '../../models/Customer.js';
import Opportunity from '../../models/Opportunity.js';
import LeadAttribution from '../../models/crm/LeadAttribution.js';
import { getAdapter } from '../../integrations/platformAdapter.js';
import { normalizeMetaLead } from './leadNormalizer.service.js';
import { attachTenantToDoc } from '../../helpers/tenantScope.js';
import { generateIds } from '../idGeneration.service.js';
import { classifyDuplicate } from '../duplicate.service.js';
import { recalculateLeadScore } from '../crm/crmScoring.service.js';
import { applyRouting } from './routing.service.js';
import { enqueueConversionEvent } from './conversionEvent.service.js';
import { writeAuditLog } from '../audit.service.js';
import '../../integrations/meta/metaAdapter.js';

export const processLeadIngestionEvent = async (eventId) => {
  const event = await LeadIngestionEvent.findOne({ event_id: eventId });
  if (!event) throw new Error(`Ingestion event not found: ${eventId}`);
  if (event.processing_status === 'COMPLETED') return { skipped: true, reason: 'already_completed' };

  event.processing_status = 'PROCESSING';
  event.attempts += 1;
  await event.save();

  try {
    if (event.platform === 'meta') {
      return await processMetaIngestion(event);
    }
    throw new Error(`Unsupported platform: ${event.platform}`);
  } catch (err) {
    event.processing_status = 'FAILED';
    event.last_error = err?.message || String(err);
    await event.save();
    throw err;
  }
};

const processMetaIngestion = async (event) => {
  const formId = event.meta_form_id || event.raw_payload?.form_id;
  const mapping = formId
    ? await MetaFormMapping.findOne({ meta_form_id: formId, status: 'MAPPED' }).lean()
    : null;

  if (!mapping) {
    event.processing_status = 'UNMAPPED';
    event.mapping_status = 'UNMAPPED';
    event.last_error = 'No form mapping configured';
    await event.save();
    return { status: 'unmapped', event_id: event.event_id };
  }

  const tenantContext = {
    tenant_id: mapping.tenant_id,
    organization_id: mapping.organization_id,
    dealer_id: mapping.dealer_id,
    branch_id: mapping.branch_id,
    user_id: 'system',
  };

  const adapter = getAdapter('meta');
  const metaLead = await adapter.fetchLead({
    tenantContext,
    externalLeadId: event.external_lead_id,
    pageId: event.raw_payload?.page_id,
  });

  const normalized = normalizeMetaLead(metaLead, {
    form_id: formId,
    ad_id: event.raw_payload?.ad_id,
    external_lead_id: event.external_lead_id,
  });
  event.normalized_payload = normalized;
  event.tenant_id = mapping.tenant_id;
  event.organization_id = mapping.organization_id;
  event.dealer_id = mapping.dealer_id;
  event.branch_id = mapping.branch_id;
  event.mapping_status = 'MAPPED';

  if (!normalized.mobile) {
    event.processing_status = 'FAILED';
    event.last_error = 'Invalid or missing phone number';
    await event.save();
    return { status: 'failed', reason: 'invalid_phone' };
  }

  let customer = await Customer.findOne({
    tenant_id: mapping.tenant_id,
    mobile_normalized: normalized.mobile,
  });

  if (!customer) {
    const ids = generateIds(normalized.name);
    customer = await Customer.create(attachTenantToDoc(tenantContext, {
      customer_id: ids.customer_id,
      name: normalized.name,
      first_name: normalized.first_name,
      last_name: normalized.last_name,
      mobile: normalized.mobile_display || normalized.mobile,
      mobile_normalized: normalized.mobile,
      whatsapp_number: normalized.whatsapp_number,
      email: normalized.email,
      city: normalized.city,
      state: normalized.state,
      pincode: normalized.pincode,
      source: 'Meta',
    }));
  }

  const dup = await classifyDuplicate({
    customer_id: customer.customer_id,
    product: mapping.product || 'General',
    requirement: null,
    tenantContext,
  });

  let opportunity;
  if (dup.duplicate) {
    opportunity = await Opportunity.findOne({ opportunity_id: dup.opportunity.opportunity_id });
    event.processing_status = 'COMPLETED';
    event.opportunity_id = opportunity.opportunity_id;
    event.customer_id = customer.customer_id;
    event.processed_at = new Date();
    await event.save();
    return { status: 'existing_lead', opportunity_id: opportunity.opportunity_id };
  }

  const ids = generateIds(normalized.name);
  opportunity = await Opportunity.create(attachTenantToDoc(tenantContext, {
    opportunity_id: ids.opportunity_id,
    lead_id: ids.lead_id,
    customer_id: customer.customer_id,
    product: mapping.product || 'General',
    source: 'Meta',
    campaign: normalized.campaign,
    branch: mapping.branch_id || 'Default Branch',
    current_owner: mapping.default_owner || 'Sales Executive',
    external_lead_id: normalized.external_lead_id,
    external_source_id: 'meta',
    received_at: normalized.received_at,
  }));

  await LeadAttribution.create({
    attribution_id: `ATTR-${opportunity.opportunity_id}`,
    opportunity_id: opportunity.opportunity_id,
    ...attachTenantToDoc(tenantContext, {}),
    source: normalized.source,
    medium: normalized.medium,
    campaign: normalized.campaign,
    campaign_id: normalized.campaign_id,
    ad_id: normalized.ad_id,
    ad_set_id: normalized.ad_set_id,
    form_id: normalized.form_id,
    external_lead_id: normalized.external_lead_id,
    platform: 'meta',
    utm_source: normalized.utm_source,
    utm_medium: normalized.utm_medium,
    utm_campaign: normalized.utm_campaign,
    captured_at: normalized.received_at,
  });

  await applyRouting({ tenantContext, opportunity, normalized, mapping });

  try {
    await recalculateLeadScore({ tenantContext, leadId: opportunity.opportunity_id });
  } catch { /* non-blocking */ }

  await enqueueConversionEvent({
    tenantContext,
    opportunity,
    event_type: 'lead_created',
    correlation_id: event.correlation_id,
  });

  event.processing_status = 'COMPLETED';
  event.opportunity_id = opportunity.opportunity_id;
  event.customer_id = customer.customer_id;
  event.processed_at = new Date();
  await event.save();

  await writeAuditLog({
    tenantContext,
    action: 'lead.ingested',
    entity_type: 'opportunity',
    entity_id: opportunity.opportunity_id,
    after: { source: 'meta', external_lead_id: normalized.external_lead_id },
    correlation_id: event.correlation_id,
  });

  return { status: 'created', opportunity_id: opportunity.opportunity_id, customer_id: customer.customer_id };
};
