import Opportunity from '../models/Opportunity.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { moveStage } from './stageTransition.service.js';
import { getNextJourneyMicroStage } from '../constants/stages.js';

const withCustomer = async (opportunity) => {
  const Customer = (await import('../models/Customer.js')).default;
  const customer = await Customer.findOne({ customer_id: opportunity.customer_id }).lean();
  return {
    ...opportunity.toObject?.() ?? opportunity,
    customer_name: customer?.name,
    customer_mobile: customer?.mobile,
  };
};

export const saveStageStep = async (opportunityId, { micro_stage, notes, fields, owner }, changedBy = 'System') => {
  const opportunity = await Opportunity.findOne({ opportunity_id: opportunityId });
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');

  const code = micro_stage?.trim();
  if (!code) throw new ApiError(400, 'INVALID_STAGE', 'micro_stage is required');

  const data = opportunity.stage_step_data && typeof opportunity.stage_step_data === 'object'
    ? { ...opportunity.stage_step_data }
    : {};

  const prev = data[code] && typeof data[code] === 'object' ? data[code] : {};
  const mergedFields = fields && typeof fields === 'object'
    ? { ...(prev.fields || {}), ...fields }
    : (prev.fields || {});

  data[code] = {
    ...prev,
    notes: notes ?? prev.notes ?? '',
    fields: mergedFields,
    owner: owner ?? prev.owner ?? opportunity.current_owner,
    updated_at: new Date().toISOString(),
    updated_by: changedBy,
  };

  opportunity.stage_step_data = data;
  opportunity.last_activity_at = new Date();
  await opportunity.save();
  return withCustomer(opportunity);
};

export const advanceToNextStage = async (opportunityId, { notes, fields, owner }, changedBy = 'System') => {
  const opportunity = await Opportunity.findOne({ opportunity_id: opportunityId });
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');

  const current = opportunity.current_micro_stage;
  const next = getNextJourneyMicroStage(current);
  if (!next) {
    throw new ApiError(400, 'NO_NEXT_STAGE', 'This lead is already at the final lifecycle stage');
  }

  const data = opportunity.stage_step_data && typeof opportunity.stage_step_data === 'object'
    ? { ...opportunity.stage_step_data }
    : {};

  data[current] = {
    ...(data[current] || {}),
    notes: notes ?? data[current]?.notes ?? '',
    fields: fields && typeof fields === 'object'
      ? { ...(data[current]?.fields || {}), ...fields }
      : (data[current]?.fields || {}),
    owner: owner ?? data[current]?.owner ?? opportunity.current_owner,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: changedBy,
  };

  opportunity.stage_step_data = data;
  await opportunity.save();

  const updated = await moveStage({
    opportunity_id: opportunityId,
    new_micro_stage: next,
    changed_by: changedBy,
    reason: `Completed ${current} and advanced to ${next} from lead detail journey`,
    force: false,
  });

  return withCustomer(updated);
};
