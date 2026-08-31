import Opportunity from '../../models/Opportunity.js';
import OpportunityOwnership from '../../models/OpportunityOwnership.js';
import AssignmentHistory from '../../models/crm/AssignmentHistory.js';
import { assertTenantAccess } from '../../middleware/tenant.middleware.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { writeAuditLog } from '../audit.service.js';
import { publishEvent } from '../event.service.js';

export const assignLead = async ({
  tenantContext,
  leadId,
  new_owner,
  reason = null,
  correlation_id = null,
  ip_address = null,
}) => {
  const opportunity = await Opportunity.findOne({
    $or: [{ opportunity_id: leadId }, { lead_id: leadId }],
  });

  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  if (!new_owner?.trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'new_owner is required', 'new_owner');
  }

  const before = {
    current_owner: opportunity.current_owner,
    escalation_owner: opportunity.escalation_owner,
  };

  const previousOwner = opportunity.current_owner;
  opportunity.current_owner = new_owner.trim();
  opportunity.updated_by = tenantContext.user_email || tenantContext.user_id;
  opportunity.last_activity_at = new Date();
  await opportunity.save();

  await AssignmentHistory.create({
    opportunity_id: opportunity.opportunity_id,
    lead_id: opportunity.lead_id,
    tenant_id: tenantContext.tenant_id,
    organization_id: tenantContext.organization_id,
    dealer_id: tenantContext.dealer_id,
    branch_id: tenantContext.branch_id,
    previous_owner: previousOwner,
    new_owner: new_owner.trim(),
    assigned_by: tenantContext.user_name || tenantContext.user_email,
    reason,
  });

  await OpportunityOwnership.create({
    opportunity_id: opportunity.opportunity_id,
    owner: new_owner.trim(),
    role: 'Sales Executive',
    is_primary: true,
    assigned_by: tenantContext.user_name || tenantContext.user_email,
  });

  await writeAuditLog({
    tenantContext,
    action: 'lead.assigned',
    entity_type: 'opportunity',
    entity_id: opportunity.opportunity_id,
    before,
    after: { current_owner: opportunity.current_owner },
    correlation_id,
    ip_address,
  });

  await publishEvent({
    type: 'lead.assigned',
    opportunity_id: opportunity.opportunity_id,
    customer_id: opportunity.customer_id,
    payload: { previousOwner, new_owner: new_owner.trim(), reason },
    correlation_id,
  });

  return opportunity;
};
