import Opportunity from '../models/Opportunity.js';
import ScoreLedger from '../models/ScoreLedger.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';

const POINTS = { contact_verified: 10, bot_engaged: 8, lead_qualified: 20, quote_shared: 15, finance_started: 25, booking_done: 40, delivery_done: 50 };
const classify = (score) => score >= 90 ? 'Critical' : score >= 60 ? 'Hot' : score >= 30 ? 'Warm' : 'Cold';

export const applyScore = async ({ opportunity_id, event_type }) => {
  const opportunity = await Opportunity.findOne({ opportunity_id });
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');
  const points = POINTS[event_type] ?? 1;
  opportunity.lead_score += points;
  opportunity.score_classification = classify(opportunity.lead_score);
  await opportunity.save();
  await ScoreLedger.create({ opportunity_id, event_type, points, score_after: opportunity.lead_score, classification_after: opportunity.score_classification });
  return opportunity;
};
