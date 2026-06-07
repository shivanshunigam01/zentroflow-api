import { ok } from '../helpers/apiResponse.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import {
  getSmartfloBatchStatus,
  getSyncLogByBatchId,
  initiateClickToCall,
  isClickToCallConfigured,
  isSmartfloConfigured,
  syncLeadsToSmartflo,
} from '../services/smartflo.service.js';

export const smartfloConfigStatus = asyncHandler(async (_req, res) => {
  ok(res, {
    configured: isSmartfloConfigured(),
    clickToCallConfigured: isClickToCallConfigured(),
    ivrId: env.SMARTFLO_IVR_ID,
  });
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

/** POST /smartflo/call — trigger IVR click-to-call for one lead */
export const smartfloClickToCall = asyncHandler(async (req, res) => {
  console.log('[Smartflo CTC] Controller body:', req.body);
  const result = await initiateClickToCall(req.body.phoneNumber, {
    opportunityId: req.body.opportunityId,
    customerName: req.body.customerName,
    requestedBy: req.user?.name || req.user?.email || 'User',
  });
  ok(res, result);
});
