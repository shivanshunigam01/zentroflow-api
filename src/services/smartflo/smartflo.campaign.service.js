import { env } from '../../config/env.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import Opportunity from '../../models/Opportunity.js';
import DialerCall from '../../models/DialerCall.js';
import SmartfloWebhookEvent from '../../models/SmartfloWebhookEvent.js';
import { smartfloGet, smartfloPatch } from './smartflo.client.js';
import { asArray, firstString, maskId } from './smartflo.helpers.js';

const campaignId = () => env.SMARTFLO_CAMPAIGN_ID?.trim() || null;

const SAFE_PATCH_KEYS = new Set(['name', 'description', 'status']);

export const fetchCampaignRaw = async () => {
  const id = campaignId();
  if (!id) throw new ApiError(503, 'SMARTFLO_NOT_CONFIGURED', 'Smartflo campaign is not configured');
  try {
    return await smartfloGet(`/broadcast/campaign/${encodeURIComponent(id)}`, undefined, 'getCampaign');
  } catch (err) {
    if (err.code === 'SMARTFLO_NOT_FOUND') {
      return smartfloGet(`/broadcast/campaigns/${encodeURIComponent(id)}`, undefined, 'getCampaignAlt');
    }
    throw err;
  }
};

export const sanitizeCampaign = (raw = {}) => {
  const id = firstString(raw.id, raw.campaign_id, raw.campaignId, campaignId());
  const status = firstString(raw.status, raw.campaign_status, raw.state) || 'UNKNOWN';
  return {
    name: firstString(raw.name, raw.campaign_name) || 'ZentroFLOW Auto Dialer',
    status: String(status).toUpperCase(),
    campaignIdMasked: maskId(id),
    leadListIdMasked: maskId(env.SMARTFLO_LEAD_LIST_ID),
    dispositionListIdMasked: maskId(env.SMARTFLO_DISPOSITION_LIST_ID),
    callerIdConfigured: Boolean(env.SMARTFLO_CALLER_ID?.trim()),
    dialerMode: env.SMARTFLO_DIALER_MODE,
    sessionEnabled: Boolean(env.SMARTFLO_API_TOKEN?.trim() && env.SMARTFLO_CAMPAIGN_ID?.trim()),
    agentCount: Number(raw.agent_count ?? raw.agents ?? raw.active_agents ?? 0) || 0,
    leadCount: Number(raw.lead_count ?? raw.total_leads ?? raw.leads ?? 0) || 0,
    newLeadCount: Number(raw.new_leads ?? raw.available_leads ?? raw.pending_leads ?? 0) || 0,
  };
};

export const getCampaignSnapshot = async () => {
  let remote = {};
  let connected = false;
  try {
    remote = await fetchCampaignRaw();
    connected = true;
  } catch {
    connected = Boolean(env.SMARTFLO_API_TOKEN?.trim());
  }
  const localLeads = await Opportunity.countDocuments({ smartflo_sync_status: 'SYNCED' });
  const pendingLeads = await Opportunity.countDocuments({
    $or: [
      { smartflo_sync_status: { $in: ['PENDING', 'FAILED'] } },
      { smartflo_sync_status: { $exists: false } },
      { smartflo_sync_status: null },
    ],
  });
  const callAgg = await DialerCall.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        successful: { $sum: { $cond: [{ $in: ['$status', ['CONVERTED', 'INTERESTED', 'COMPLETED', 'CONTACTED']] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $in: ['$status', ['FAILED', 'NO_ANSWER', 'BUSY', 'CALL_DROPPED']] }, 1, 0] } },
      },
    },
  ]);
  const lastWebhook = await SmartfloWebhookEvent.findOne().sort({ created_at: -1 }).lean();
  const snapshot = sanitizeCampaign(remote);
  if (!snapshot.leadCount) snapshot.leadCount = localLeads;
  snapshot.syncedLeadCount = localLeads;
  snapshot.pendingLeadCount = pendingLeads;
  snapshot.completedCalls = callAgg[0]?.total || 0;
  snapshot.successfulCalls = callAgg[0]?.successful || 0;
  snapshot.failedCalls = callAgg[0]?.failed || 0;
  snapshot.connected = connected;
  snapshot.lastWebhook = lastWebhook ? {
    event: lastWebhook.event_type,
    callId: lastWebhook.smartflo_call_id,
    disposition: lastWebhook.disposition,
    receivedAt: lastWebhook.created_at,
  } : null;
  return snapshot;
};

export const getCampaignStatus = async () => {
  const snap = await getCampaignSnapshot();
  return {
    campaignId: snap.campaignIdMasked,
    status: snap.status || 'UNKNOWN',
    leadCount: snap.leadCount,
    availableLeadCount: snap.newLeadCount || snap.pendingLeadCount,
    activeAgents: snap.agentCount,
    dialerMode: snap.dialerMode,
    connected: snap.connected,
  };
};

export const patchCampaignSafe = async (body = {}) => {
  const id = campaignId();
  if (!id) throw new ApiError(503, 'SMARTFLO_NOT_CONFIGURED', 'Smartflo campaign is not configured');
  const payload = {};
  for (const key of SAFE_PATCH_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  if (Object.keys(payload).length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'No safe campaign fields to update');
  }
  const raw = await smartfloPatch(`/broadcast/campaign/${encodeURIComponent(id)}`, payload, 'patchCampaign');
  return sanitizeCampaign(raw);
};
