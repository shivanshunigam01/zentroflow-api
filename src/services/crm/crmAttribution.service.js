import LeadAttribution from '../../models/crm/LeadAttribution.js';
import Opportunity from '../../models/Opportunity.js';
import { assertTenantAccess } from '../../middleware/tenant.middleware.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { attachTenantToDoc } from '../../helpers/tenantScope.js';

export const getLeadAttribution = async (tenantContext, leadId) => {
  const opportunity = await Opportunity.findOne({
    $or: [{ opportunity_id: leadId }, { lead_id: leadId }],
  }).lean();

  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  const attribution = await LeadAttribution.findOne({
    opportunity_id: opportunity.opportunity_id,
    tenant_id: tenantContext.tenant_id,
  }).lean();

  if (attribution) return attribution;

  return {
    opportunity_id: opportunity.opportunity_id,
    source: opportunity.source || null,
    medium: null,
    campaign: opportunity.campaign || null,
    campaign_id: null,
    ad_id: null,
    ad_set_id: null,
    ad_name: null,
    form_id: null,
    external_lead_id: opportunity.external_lead_id || null,
    platform: opportunity.external_source_id || opportunity.source || null,
    landing_page: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: opportunity.campaign || null,
    utm_content: null,
    utm_term: null,
    gclid: null,
    fbclid: null,
    captured_at: opportunity.received_at || opportunity.created_at,
    _derived_from_opportunity: true,
  };
};

export const upsertLeadAttribution = async (tenantContext, opportunityId, data) => {
  const opportunity = await Opportunity.findOne({ opportunity_id: opportunityId });
  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  const payload = attachTenantToDoc(tenantContext, {
    opportunity_id: opportunityId,
    ...data,
  });

  return LeadAttribution.findOneAndUpdate(
    { opportunity_id: opportunityId, tenant_id: tenantContext.tenant_id },
    { $set: payload, $setOnInsert: { attribution_id: `ATTR-${opportunityId}` } },
    { upsert: true, new: true },
  );
};
