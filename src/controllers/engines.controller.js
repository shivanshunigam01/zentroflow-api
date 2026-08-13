import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';
import { runActionEngineOnOpportunity } from '../services/actionEngine.service.js';
import { verifyContactHealth } from '../services/contactHealth.service.js';
import { applyScore } from '../services/scoring.service.js';
import { getSlaState } from '../services/sla.service.js';

export const runActionEngine = asyncHandler(async (req, res) => {
  const opportunity = await runActionEngineOnOpportunity(req.body.opportunity_id);
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');
  ok(res, opportunity);
});
export const verifyContact = asyncHandler(async (req, res) => ok(res, await verifyContactHealth(req.body)));
export const scoreApply = asyncHandler(async (req, res) => ok(res, await applyScore(req.body)));
export const slaState = asyncHandler(async (req, res) => ok(res, await getSlaState(req.params.opportunityId)));
