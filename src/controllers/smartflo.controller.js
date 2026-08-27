import { ok } from '../helpers/apiResponse.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import {
  getSmartfloBatchStatus,
  getSyncLogByBatchId,
  initiateClickToCall,
  initiateDirectAgentCall,
  isClickToCallConfigured,
  isDirectAgentCallConfigured,
  isSmartfloConfigured,
  syncLeadsToSmartflo,
} from '../services/smartflo.service.js';

export const smartfloConfigStatus = asyncHandler(async (_req, res) => {
  ok(res, {
    configured: isSmartfloConfigured(),
    clickToCallConfigured: isClickToCallConfigured(),
    directAgentCallConfigured: isDirectAgentCallConfigured(),
    campaignConfigured: Boolean(env.SMARTFLO_CAMPAIGN_ID?.trim()),
    dispositionConfigured: Boolean(env.SMARTFLO_DISPOSITION_LIST_ID?.trim()),
    dialerMode: env.SMARTFLO_DIALER_MODE,
    sessionEnabled: Boolean(env.SMARTFLO_API_TOKEN?.trim() && env.SMARTFLO_CAMPAIGN_ID?.trim()),
    callerIdConfigured: Boolean(env.SMARTFLO_CALLER_ID?.trim()),
    // Destination IVR is configured on the Support API key in Smartflo — never expose the key
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

/** POST /smartflo/call — Click-to-Call Support (customer-first → IVR/destination on API key) */
export const smartfloClickToCall = asyncHandler(async (req, res) => {
  // Ignore client-supplied ivrId — destination is bound to SMARTFLO_CLICK_TO_CALL_API_KEY
  const result = await initiateClickToCall(req.body.phoneNumber, {
    opportunityId: req.body.opportunityId,
    customerName: req.body.customerName,
    requestedBy: req.user?.name || req.user?.email || 'User',
    source: 'zentroflow_ivr',
  });
  ok(res, result);
});

/** POST /smartflo/agent-call — direct agent click-to-call (/v1/click_to_call) */
export const smartfloDirectAgentCall = asyncHandler(async (req, res) => {
  console.log('[Smartflo Agent CTC] Controller body:', req.body);
  const result = await initiateDirectAgentCall(req.body.phoneNumber, {
    opportunityId: req.body.opportunityId,
    customerName: req.body.customerName,
    requestedBy: req.user?.name || req.user?.email || 'User',
  });
  ok(res, result);
});
