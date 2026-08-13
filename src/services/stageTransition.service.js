import Opportunity from '../models/Opportunity.js';
import StageHistory from '../models/StageHistory.js';
import LeadActivity from '../models/LeadActivity.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { validateSequentialTransition } from './stageGates.service.js';
import { applyStageMasterDefaults } from './actionEngine.service.js';
import { publishEvent } from './event.service.js';
import { getMacroFromMicroStage, LIFECYCLE_STAGES } from '../constants/stages.js';

export const moveStage = async ({ opportunity_id, new_micro_stage, changed_by = 'System', reason, force = false, correlation_id }) => {
  const opportunity = await Opportunity.findOne({ opportunity_id });
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');

  if (!force) validateSequentialTransition(opportunity, new_micro_stage, { force: false });
  if (force && (!reason || reason.length < 10)) throw new ApiError(400, 'FORCE_REASON_REQUIRED', 'Force override requires a reason of at least 10 characters', 'reason');

  const fromMicro = opportunity.current_micro_stage;
  const fromStage = opportunity.current_stage || opportunity.lifecycle_stage;
  const toStage = getMacroFromMicroStage(new_micro_stage);
  const isLifecycle = LIFECYCLE_STAGES.includes(toStage);

  Object.assign(opportunity, applyStageMasterDefaults(opportunity, new_micro_stage), {
    current_micro_stage: new_micro_stage,
    current_stage: isLifecycle ? null : toStage,
    lifecycle_stage: isLifecycle ? toStage : null,
    last_activity_at: new Date(),
  });
  await opportunity.save();

  await StageHistory.create({ opportunity_id, from_micro_stage: fromMicro, to_micro_stage: new_micro_stage, from_stage: fromStage, to_stage: toStage, changed_by, reason, forced: force });
  await LeadActivity.create({ opportunity_id, customer_id: opportunity.customer_id, type: 'stage.changed', title: 'Stage changed', description: `${fromMicro} → ${new_micro_stage}`, changed_by });
  await publishEvent({ type: 'stage.changed', opportunity_id, customer_id: opportunity.customer_id, payload: { fromMicro, new_micro_stage }, correlation_id });

  return opportunity;
};
