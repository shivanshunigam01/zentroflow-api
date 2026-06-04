import Opportunity from '../models/Opportunity.js';
import SlaTracking from '../models/SlaTracking.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';

export const getSlaState = async (opportunity_id) => {
  const opportunity = await Opportunity.findOne({ opportunity_id });
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');
  const now = new Date();
  const due = opportunity.sla_due_at || opportunity.next_action_date;
  const sla_status = due && due < now ? 'Breached' : due && due - now < 4 * 60 * 60 * 1000 ? 'At Risk' : 'On Track';
  opportunity.sla_status = sla_status;
  await opportunity.save();
  return SlaTracking.findOneAndUpdate({ opportunity_id }, { sla_due_at: due, sla_status, breached_at: sla_status === 'Breached' ? now : null, escalation_owner: opportunity.escalation_owner }, { upsert: true, new: true });
};
