import LeadActivity from '../models/LeadActivity.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';
export const listActivities = asyncHandler(async (req, res) => ok(res, await LeadActivity.find(req.query.opportunity_id ? { opportunity_id: req.query.opportunity_id } : {}).sort({ created_at: -1 }).limit(100)));
