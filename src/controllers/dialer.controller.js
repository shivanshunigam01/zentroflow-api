import { ok } from '../helpers/apiResponse.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { getPagination, paginationMeta } from '../helpers/pagination.js';
import Opportunity from '../models/Opportunity.js';
import { getCampaignSnapshot, getCampaignStatus, patchCampaignSafe } from '../services/smartflo/smartflo.campaign.service.js';
import {
  compareLocalAndRemoteLead,
  fetchLeadLists,
  fetchLeadsInList,
  getDialerLeadSyncStats,
  syncAllLeadsToSmartflo,
  syncOpportunityToSmartflo,
  syncPendingLeads,
  syncSelectedLeads,
} from '../services/smartflo/smartflo.leads.service.js';
import { fetchDispositions, storeDisposition } from '../services/smartflo/smartflo.disposition.service.js';
import {
  endDialerSession,
  getSessionStatus,
  logoutDialerSession,
  startDialerSession,
} from '../services/smartflo/smartflo.session.service.js';
import { getLocalCall, listCallbacks, listLocalCalls } from '../services/smartflo/smartflo.calls.service.js';
import { enrichLeadDto } from '../helpers/leadDto.js';

export const dialerHealth = asyncHandler(async (_req, res) => {
  ok(res, {
    smartflo: Boolean(env.SMARTFLO_API_TOKEN?.trim()),
    campaignConfigured: Boolean(env.SMARTFLO_CAMPAIGN_ID?.trim()),
    leadListConfigured: Boolean(env.SMARTFLO_LEAD_LIST_ID?.trim()),
    dispositionConfigured: Boolean(env.SMARTFLO_DISPOSITION_LIST_ID?.trim()),
    callerIdConfigured: Boolean(env.SMARTFLO_CALLER_ID?.trim()),
    dialerMode: env.SMARTFLO_DIALER_MODE,
    sessionEnabled: env.SMARTFLO_DIALER_MODE === 'session',
  });
});

export const getDialerCampaign = asyncHandler(async (_req, res) => {
  ok(res, await getCampaignSnapshot());
});

export const getDialerCampaignStatus = asyncHandler(async (_req, res) => {
  ok(res, await getCampaignStatus());
});

export const patchDialerCampaign = asyncHandler(async (req, res) => {
  ok(res, await patchCampaignSafe(req.body));
});

export const listDialerLeadLists = asyncHandler(async (_req, res) => {
  ok(res, await fetchLeadLists());
});

export const listDialerRemoteLeads = asyncHandler(async (req, res) => {
  ok(res, await fetchLeadsInList(req.params.listId));
});

export const listDialerLeads = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.syncStatus) filter.smartflo_sync_status = req.query.syncStatus;
  const [rows, total] = await Promise.all([
    Opportunity.find(filter).sort({ updated_at: -1 }).skip(skip).limit(limit),
    Opportunity.countDocuments(filter),
  ]);
  const data = await Promise.all(rows.map((row) => enrichLeadDto(row)));
  ok(res, data, paginationMeta({ page, limit, total }));
});

export const syncDialerLead = asyncHandler(async (req, res) => {
  ok(res, await syncOpportunityToSmartflo(req.params.id));
});

export const syncPendingDialerLeads = asyncHandler(async (req, res) => {
  if (req.body?.syncAll === true) {
    ok(res, await syncAllLeadsToSmartflo(req.user?.email || req.user?.name || 'Admin'));
    return;
  }
  ok(res, await syncPendingLeads(200));
});

export const getDialerLeadSyncStatsHandler = asyncHandler(async (_req, res) => {
  ok(res, await getDialerLeadSyncStats());
});

export const bulkSyncDialerLeads = asyncHandler(async (req, res) => {
  ok(res, await syncSelectedLeads(req.body.leadIds));
});

export const testSyncLead = asyncHandler(async (req, res) => {
  ok(res, await syncOpportunityToSmartflo(req.body.leadId));
});

export const testLeadStatus = asyncHandler(async (req, res) => {
  ok(res, await compareLocalAndRemoteLead(req.params.leadId));
});

export const listDialerDispositions = asyncHandler(async (_req, res) => {
  ok(res, await fetchDispositions());
});

export const postDialerDisposition = asyncHandler(async (req, res) => {
  ok(res, await storeDisposition({
    leadId: req.body.leadId,
    callId: req.body.callId,
    dispositionStatus: req.body.dispositionStatus,
    subDispositionStatus: req.body.subDispositionStatus,
    note: req.body.note,
    changedBy: req.user?.name || req.user?.email || 'Agent',
  }));
});

export const listDialerCalls = asyncHandler(async (req, res) => {
  const { rows, meta } = await listLocalCalls(req.query);
  ok(res, rows, meta);
});

export const getDialerCall = asyncHandler(async (req, res) => {
  const row = await getLocalCall(req.params.id);
  if (!row) throw new ApiError(404, 'CALL_NOT_FOUND', 'Call not found');
  ok(res, row);
});

export const listDialerCallbacks = asyncHandler(async (_req, res) => {
  ok(res, await listCallbacks());
});

export const startSession = asyncHandler(async (req, res) => {
  ok(res, await startDialerSession(req.user));
});

export const endSession = asyncHandler(async (req, res) => {
  ok(res, await endDialerSession(req.user));
});

export const logoutSession = asyncHandler(async (req, res) => {
  ok(res, await logoutDialerSession(req.user));
});

export const sessionStatus = asyncHandler(async (req, res) => {
  ok(res, await getSessionStatus(req.user));
});

export const createDialerLead = asyncHandler(async (req, res) => {
  const { opportunityId, leadId } = req.body;
  const id = opportunityId || leadId;
  if (!id) throw new ApiError(400, 'VALIDATION_ERROR', 'opportunityId is required');
  ok(res, await syncOpportunityToSmartflo(id), { status: 201 });
});
