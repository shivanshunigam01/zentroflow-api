import Opportunity from '../../models/Opportunity.js';
import { assertTenantAccess } from '../../middleware/tenant.middleware.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { moveStage } from '../stageTransition.service.js';
import { writeAuditLog } from '../audit.service.js';

export const changeLeadStage = async ({
  tenantContext,
  leadId,
  new_micro_stage,
  reason,
  force = false,
  correlation_id = null,
  ip_address = null,
}) => {
  const opportunity = await Opportunity.findOne({
    $or: [{ opportunity_id: leadId }, { lead_id: leadId }],
  }).lean();

  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  const before = {
    current_micro_stage: opportunity.current_micro_stage,
    current_stage: opportunity.current_stage,
    lifecycle_stage: opportunity.lifecycle_stage,
  };

  const updated = await moveStage({
    opportunity_id: opportunity.opportunity_id,
    new_micro_stage,
    changed_by: tenantContext.user_name || tenantContext.user_email || 'CRM User',
    reason,
    force,
    correlation_id,
  });

  await writeAuditLog({
    tenantContext,
    action: 'lead.stage_changed',
    entity_type: 'opportunity',
    entity_id: opportunity.opportunity_id,
    before,
    after: {
      current_micro_stage: updated.current_micro_stage,
      current_stage: updated.current_stage,
      lifecycle_stage: updated.lifecycle_stage,
    },
    correlation_id,
    ip_address,
  });

  return updated;
};
