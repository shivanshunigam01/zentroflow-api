import Opportunity from '../models/Opportunity.js';
import Customer from '../models/Customer.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';

export const stats = asyncHandler(async (req, res) => {
  const [totalCustomers, totalLeads, hot, slaMissed, byStage] = await Promise.all([
    Customer.countDocuments(),
    Opportunity.countDocuments(),
    Opportunity.countDocuments({ score_classification: { $in: ['Hot', 'Critical'] } }),
    Opportunity.countDocuments({ sla_status: 'Breached' }),
    Opportunity.aggregate([{ $group: { _id: '$current_stage', count: { $sum: 1 } } }]),
  ]);
  ok(res, { totalCustomers, totalLeads, hot, slaMissed, byStage });
});
