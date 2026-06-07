import { ok } from '../helpers/apiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import {
  getSmartfloBatchStatus,
  getSyncLogByBatchId,
  isSmartfloConfigured,
  syncLeadsToSmartflo,
} from '../services/smartflo.service.js';

export const smartfloConfigStatus = asyncHandler(async (_req, res) => {
  ok(res, { configured: isSmartfloConfigured() });
});

export const syncSmartfloLeads = asyncHandler(async (req, res) => {
  const result = await syncLeadsToSmartflo(req.user?.name || req.user?.email || 'Admin');
  ok(res, result);
});

export const smartfloBatchStatus = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const smartfloStatus = await getSmartfloBatchStatus(batchId);
  const stored = await getSyncLogByBatchId(batchId);

  ok(res, {
    batchId,
    smartflo: smartfloStatus,
    stored: stored?.batch ?? null,
    syncId: stored?.log?.sync_id ?? null,
  });
});
