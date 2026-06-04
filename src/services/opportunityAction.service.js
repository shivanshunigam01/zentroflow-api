import Opportunity from '../models/Opportunity.js';
import { ACTION_REGISTRY } from '../constants/actionRegistry.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { moveStage } from './stageTransition.service.js';

export const performAction = async ({ opportunity_id, action_label, changed_by, force, reason, correlation_id }) => {
  const action = ACTION_REGISTRY[action_label];
  if (!action) throw new ApiError(400, 'ACTION_NOT_FOUND', `Action label not found: ${action_label}`, 'action_label');

  if (action.microStage) {
    const opportunity = await moveStage({
      opportunity_id,
      new_micro_stage: action.microStage,
      changed_by,
      force,
      reason,
      correlation_id,
    });
    if (action.status) {
      opportunity.status = action.status;
      await opportunity.save();
    }
    return opportunity;
  }

  if (action.status) {
    const opportunity = await Opportunity.findOne({ opportunity_id });
    if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');
    opportunity.status = action.status;
    opportunity.last_activity_at = new Date();
    await opportunity.save();
    return opportunity;
  }

  const opportunity = await Opportunity.findOne({ opportunity_id });
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');
  return opportunity;
};
