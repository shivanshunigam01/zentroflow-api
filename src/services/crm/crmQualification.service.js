import Opportunity from '../../models/Opportunity.js';
import LeadActivity from '../../models/LeadActivity.js';
import { assertTenantAccess } from '../../middleware/tenant.middleware.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { writeAuditLog } from '../audit.service.js';
import { publishEvent } from '../event.service.js';
import { applyScore } from '../scoring.service.js';

const resolveLead = async (leadId) =>
  Opportunity.findOne({ $or: [{ opportunity_id: leadId }, { lead_id: leadId }] });

export const qualifyLead = async ({
  tenantContext,
  leadId,
  notes,
  correlation_id,
  ip_address,
}) => {
  const opportunity = await resolveLead(leadId);
  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  const before = { qualification_status: opportunity.qualification_status };
  opportunity.qualification_status = 'QUALIFIED';
  opportunity.verification_status = opportunity.verification_status || 'VERIFIED';
  opportunity.updated_by = tenantContext.user_email || tenantContext.user_id;
  opportunity.last_activity_at = new Date();
  await opportunity.save();

  await LeadActivity.create({
    opportunity_id: opportunity.opportunity_id,
    customer_id: opportunity.customer_id,
    type: 'lead.qualified',
    title: 'Lead qualified',
    description: notes || 'Marked as qualified via CRM',
    changed_by: tenantContext.user_name || tenantContext.user_email,
  });

  try {
    await applyScore({ opportunity_id: opportunity.opportunity_id, event_type: 'lead_qualified' });
  } catch {
    /* scoring must not block qualification */
  }

  await writeAuditLog({
    tenantContext,
    action: 'lead.qualified',
    entity_type: 'opportunity',
    entity_id: opportunity.opportunity_id,
    before,
    after: { qualification_status: 'QUALIFIED' },
    correlation_id,
    ip_address,
  });

  await publishEvent({
    type: 'lead.qualified',
    opportunity_id: opportunity.opportunity_id,
    customer_id: opportunity.customer_id,
    payload: { notes },
    correlation_id,
  });

  return opportunity;
};

export const disqualifyLead = async ({
  tenantContext,
  leadId,
  reason,
  correlation_id,
  ip_address,
}) => {
  const opportunity = await resolveLead(leadId);
  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  if (!reason?.trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'reason is required for disqualification', 'reason');
  }

  const before = { qualification_status: opportunity.qualification_status };
  opportunity.qualification_status = 'DISQUALIFIED';
  opportunity.updated_by = tenantContext.user_email || tenantContext.user_id;
  opportunity.last_activity_at = new Date();
  await opportunity.save();

  await LeadActivity.create({
    opportunity_id: opportunity.opportunity_id,
    customer_id: opportunity.customer_id,
    type: 'lead.disqualified',
    title: 'Lead disqualified',
    description: reason,
    changed_by: tenantContext.user_name || tenantContext.user_email,
  });

  await writeAuditLog({
    tenantContext,
    action: 'lead.disqualified',
    entity_type: 'opportunity',
    entity_id: opportunity.opportunity_id,
    before,
    after: { qualification_status: 'DISQUALIFIED', reason },
    correlation_id,
    ip_address,
  });

  return opportunity;
};
