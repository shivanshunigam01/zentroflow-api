import { randomUUID } from 'crypto';
import { env } from '../../config/env.js';
import { isValidMobile, normalizeMobile } from '../../helpers/mobile.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import Customer from '../../models/Customer.js';
import Opportunity from '../../models/Opportunity.js';
import SmartfloSyncLog from '../../models/SmartfloSyncLog.js';
import { getSmartfloBatchStatus } from '../smartflo.service.js';
import { smartfloGet, smartfloPost, smartfloPut } from './smartflo.client.js';
import { asArray, firstString } from './smartflo.helpers.js';
import { writeDialerAudit } from './smartflo.audit.service.js';

const BATCH_SIZE = env.SMARTFLO_SYNC_BATCH_SIZE || 500;
const BATCH_POLL_ATTEMPTS = 30;
const BATCH_POLL_DELAY_MS = 2000;
const SYNC_LOCK_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Prevent overlapping sync-all runs in this process. */
let activeSyncAllPromise = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const listId = () => {
  const id = env.SMARTFLO_LEAD_LIST_ID?.trim();
  if (!id) throw new ApiError(503, 'SMARTFLO_NOT_CONFIGURED', 'Smartflo lead list is not configured');
  return id;
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const extractBatchId = (response) => firstString(
  response?.batch_id,
  response?.batchId,
  response?.data?.batch_id,
  response?.data?.batchId,
  response?.id,
);

/**
 * Map a ZentroFLOW opportunity + customer to Smartflo broadcast fields.
 * field_0 phone, field_1 name, field_2 email, field_3 address, field_4 branch, field_5 opportunity_id
 */
export const mapZentroflowToSmartfloLead = (opportunity, customer) => {
  const phone = normalizeMobile(customer?.mobile || customer?.mobile_normalized || '');
  if (!phone || !isValidMobile(phone)) {
    throw new ApiError(400, 'INVALID_LEAD', 'Lead phone number is invalid', 'mobile');
  }
  const row = {
    field_0: phone,
    field_1: String(customer?.name || 'Lead').trim(),
    field_5: opportunity.opportunity_id,
  };
  const email = customer?.email?.trim();
  if (email) row.field_2 = email;
  const address = customer?.address?.trim();
  if (address) row.field_3 = address;
  const company = opportunity.branch?.trim();
  if (company) row.field_4 = company;
  return row;
};

export const extractSmartfloLeadId = (response) => firstString(
  response?.lead_id,
  response?.id,
  response?.data?.lead_id,
  response?.data?.id,
  response?.data?.[0]?.lead_id,
  response?.data?.[0]?.id,
);

export const fetchLeadLists = async () => {
  const data = await smartfloGet('/broadcast/lists', undefined, 'listLeadLists');
  return asArray(data);
};

export const fetchLeadsInList = async (id = listId()) => {
  const data = await smartfloGet(`/broadcast/leads/${encodeURIComponent(id)}`, undefined, 'listLeads');
  return asArray(data);
};

export const uploadSingleSmartfloLead = async (row, id = listId()) => {
  return smartfloPost(
    `/broadcast/lead/${encodeURIComponent(id)}`,
    { ...row, duplicate_option: 'skip', priority: 1 },
    'uploadSingleLead',
  );
};

/** POST /v1/broadcast/leads/{LEAD_LIST_ID} — official Smartflo bulk upload */
export const uploadBulkSmartfloLeads = async (rows, id = listId()) => {
  return smartfloPost(
    `/broadcast/leads/${encodeURIComponent(id)}`,
    { data: rows, duplicate_option: 'skip' },
    'uploadBulkLeads',
  );
};

export const updateSmartfloLead = async (smartfloLeadId, row, id = listId()) => {
  return smartfloPut(
    `/broadcast/lead/${encodeURIComponent(id)}`,
    { id: smartfloLeadId, ...row, duplicate_option: 'skip' },
    'updateLead',
  );
};

const findRemoteLead = (leads, opportunity, customer) => {
  const phone = normalizeMobile(customer?.mobile || '');
  const oppId = opportunity.opportunity_id;
  return leads.find((row) => {
    const field0 = normalizeMobile(row.field_0 || row.phone || row.number || '');
    const field5 = String(row.field_5 || row.ref_id || '');
    const remoteId = String(row.id || row.lead_id || '');
    if (opportunity.smartflo_lead_id && remoteId && remoteId === String(opportunity.smartflo_lead_id)) return true;
    if (field5 && field5 === oppId) return true;
    if (phone && field0 && field0 === phone) return true;
    return false;
  }) || null;
};

export const findOpportunityByDialerId = (id) => Opportunity.findOne({
  $or: [{ opportunity_id: id }, { lead_id: id }],
});

const markFailed = async (opportunity, message) => {
  opportunity.smartflo_sync_status = 'FAILED';
  opportunity.smartflo_sync_error = String(message || 'Unable to synchronize lead with Smartflo').slice(0, 280);
  opportunity.smartflo_retry_count = (opportunity.smartflo_retry_count || 0) + 1;
  await opportunity.save();
};

/** True when ZentroFLOW already has a successful Smartflo sync record (skip unless resync). */
export const isAlreadySynced = (opportunity) => (
  opportunity.smartflo_sync_status === 'SYNCED' && Boolean(opportunity.smartflo_lead_id)
);

/** Classify all opportunities for sync-all stats and upload selection. */
export const classifyLeadsForSync = async () => {
  const opportunities = await Opportunity.find().lean();
  const customerIds = [...new Set(opportunities.map((o) => o.customer_id).filter(Boolean))];
  const customers = await Customer.find({ customer_id: { $in: customerIds } }).lean();
  const customerById = Object.fromEntries(customers.map((c) => [c.customer_id, c]));

  const stats = {
    total: opportunities.length,
    alreadySynced: 0,
    pendingSync: 0,
    failed: 0,
    invalid: 0,
    eligible: 0,
  };
  const toUpload = [];
  const invalidRows = [];

  for (const opp of opportunities) {
    const customer = customerById[opp.customer_id];
    const phone = normalizeMobile(customer?.mobile || customer?.mobile_normalized || '');

    if (!phone || !isValidMobile(phone)) {
      stats.invalid += 1;
      invalidRows.push({
        opportunity_id: opp.opportunity_id,
        reason: 'Invalid or missing mobile number',
      });
      continue;
    }

    if (isAlreadySynced(opp)) {
      stats.alreadySynced += 1;
      continue;
    }

    if (opp.smartflo_sync_status === 'FAILED') stats.failed += 1;
    stats.pendingSync += 1;
    stats.eligible += 1;

    try {
      toUpload.push({
        opportunity: opp,
        customer,
        row: mapZentroflowToSmartfloLead(opp, customer),
      });
    } catch (err) {
      stats.invalid += 1;
      stats.eligible -= 1;
      stats.pendingSync -= 1;
      invalidRows.push({
        opportunity_id: opp.opportunity_id,
        reason: err.message || 'Invalid lead data',
      });
    }
  }

  return { stats, toUpload, invalidRows, customerById };
};

export const getDialerLeadSyncStats = async () => {
  const { stats } = await classifyLeadsForSync();
  const runningLog = await SmartfloSyncLog.findOne({ status: { $in: ['running', 'processing'] } })
    .sort({ created_at: -1 })
    .lean();
  let syncInProgress = Boolean(activeSyncAllPromise);
  if (runningLog) {
    const age = Date.now() - new Date(runningLog.created_at).getTime();
    syncInProgress = syncInProgress || age < SYNC_LOCK_MAX_AGE_MS;
  }
  return { ...stats, syncInProgress };
};

const assertSyncNotRunning = async () => {
  if (activeSyncAllPromise) {
    throw new ApiError(409, 'SYNC_IN_PROGRESS', 'Lead synchronization is already in progress.');
  }
  const runningLog = await SmartfloSyncLog.findOne({ status: { $in: ['running', 'processing'] } })
    .sort({ created_at: -1 });
  if (runningLog) {
    const age = Date.now() - new Date(runningLog.created_at).getTime();
    if (age < SYNC_LOCK_MAX_AGE_MS) {
      throw new ApiError(409, 'SYNC_IN_PROGRESS', 'Lead synchronization is already in progress.');
    }
    runningLog.status = 'partial';
    await runningLog.save();
  }
};

/** GET /v1/broadcast/batch_status/{batchId} — poll until complete or timeout */
export const pollSmartfloBatchStatus = async (batchId) => {
  if (!batchId?.trim()) return { completed: true, response: null };

  for (let attempt = 0; attempt < BATCH_POLL_ATTEMPTS; attempt += 1) {
    const response = await getSmartfloBatchStatus(batchId);
    const message = String(response?.message ?? response?.Message ?? '').toLowerCase();
    const batchStatus = String(
      response?.status ?? response?.batch_status ?? response?.data?.status ?? '',
    ).toLowerCase();

    const completed = (
      batchStatus.includes('complete')
      || batchStatus.includes('success')
      || message.includes('complete')
      || message.includes('processed')
      || message.includes('success')
    );
    const failed = (
      batchStatus.includes('fail')
      || batchStatus.includes('error')
      || message.includes('fail')
      || message.includes('error')
    );

    if (completed) return { completed: true, response };
    if (failed) return { completed: false, response };

    await sleep(BATCH_POLL_DELAY_MS);
  }

  return { completed: false, response: { message: 'Batch status polling timed out' } };
};

const applyRemoteMatches = async (entries, remoteLeads, targetList) => {
  let matched = 0;
  for (const { opportunity, customer } of entries) {
    const doc = await Opportunity.findOne({ opportunity_id: opportunity.opportunity_id });
    if (!doc) continue;
    const match = findRemoteLead(remoteLeads, doc, customer);
    const remoteId = firstString(match?.id, match?.lead_id);
    doc.smartflo_lead_id = remoteId || doc.smartflo_lead_id || null;
    doc.smartflo_lead_list_id = targetList;
    doc.smartflo_sync_status = 'SYNCED';
    doc.smartflo_sync_error = null;
    doc.smartflo_last_synced_at = new Date();
    if (!doc.smartflo_dial_status) doc.smartflo_dial_status = 'READY';
    await doc.save();
    if (remoteId) matched += 1;
  }
  return matched;
};

/**
 * Sync all eligible ZentroFLOW opportunities to Smartflo via bulk batch upload.
 * Skips leads already marked SYNCED with a Smartflo lead id.
 */
export const syncAllLeadsToSmartflo = async (changedBy = 'System') => {
  await assertSyncNotRunning();
  const targetList = listId();
  const syncId = randomUUID();
  const { stats, toUpload, invalidRows } = await classifyLeadsForSync();

  const log = await SmartfloSyncLog.create({
    sync_id: syncId,
    sync_type: 'dialer_all',
    status: 'running',
    total_leads: stats.total,
    eligible: stats.eligible,
    already_synced: stats.alreadySynced,
    invalid: stats.invalid,
    skipped: stats.alreadySynced,
    batch_results: [],
    created_by: changedBy,
  });

  await writeDialerAudit({
    actor: changedBy,
    action: 'sync.started',
    entity: 'sync',
    entityId: syncId,
    metadata: { syncType: 'dialer_all', eligible: stats.eligible, total: stats.total },
  });

  const run = async () => {
    if (toUpload.length === 0) {
      log.status = 'completed';
      await log.save();
      await writeDialerAudit({
        actor: changedBy,
        action: 'sync.completed',
        entity: 'sync',
        entityId: syncId,
        metadata: { uploaded: 0, failed: 0, alreadySynced: stats.alreadySynced },
      });
      return {
        success: true,
        syncId,
        total: stats.total,
        eligible: stats.eligible,
        uploaded: 0,
        alreadySynced: stats.alreadySynced,
        invalid: stats.invalid,
        failed: 0,
        skipped: stats.alreadySynced,
        status: 'COMPLETED',
        batchIds: [],
        batchResults: [],
        invalidRows,
      };
    }

    const batches = chunk(toUpload, BATCH_SIZE);
    const batchResults = [];
    const batchIds = [];
    let uploaded = 0;
    let failed = 0;

    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      const rows = batch.map((entry) => entry.row);
      try {
        const response = await uploadBulkSmartfloLeads(rows, targetList);
        const batchId = extractBatchId(response);
        if (batchId) batchIds.push(batchId);

        let batchStatusResponse = null;
        let batchComplete = true;
        if (batchId) {
          log.status = 'processing';
          await log.save();
          const polled = await pollSmartfloBatchStatus(batchId);
          batchStatusResponse = polled.response;
          batchComplete = polled.completed;
        }

        if (batchComplete) {
          batchResults.push({
            batch_index: i + 1,
            batch_id: batchId,
            status: 'success',
            uploaded_count: batch.length,
            failed_count: 0,
            lead_count: batch.length,
            smartflo_response: response,
            batch_status_response: batchStatusResponse,
          });
          uploaded += batch.length;
        } else {
          batchResults.push({
            batch_index: i + 1,
            batch_id: batchId,
            status: 'processing',
            uploaded_count: 0,
            failed_count: 0,
            lead_count: batch.length,
            smartflo_response: response,
            batch_status_response: batchStatusResponse,
            error: 'Batch upload submitted but Smartflo processing not confirmed',
          });
        }
      } catch (err) {
        console.error(JSON.stringify({
          service: 'smartflo',
          operation: 'syncAll.batch',
          batchIndex: i + 1,
          status: 'failed',
          code: err.code,
          message: err.message,
        }));
        batchResults.push({
          batch_index: i + 1,
          batch_id: null,
          status: 'failed',
          uploaded_count: 0,
          failed_count: batch.length,
          lead_count: batch.length,
          error: err.message,
        });
        failed += batch.length;

        for (const entry of batch) {
          const doc = await Opportunity.findOne({ opportunity_id: entry.opportunity.opportunity_id });
          if (doc) await markFailed(doc, err.message);
        }
      }
    }

    let remoteMatched = 0;
    if (uploaded > 0) {
      try {
        const remoteLeads = await fetchLeadsInList(targetList);
        remoteMatched = await applyRemoteMatches(toUpload, remoteLeads, targetList);
      } catch (err) {
        console.error(JSON.stringify({
          service: 'smartflo',
          operation: 'syncAll.resolveRemoteIds',
          status: 'failed',
          message: err.message,
        }));
        for (const entry of toUpload) {
          const doc = await Opportunity.findOne({ opportunity_id: entry.opportunity.opportunity_id });
          if (!doc || isAlreadySynced(doc)) continue;
          doc.smartflo_lead_list_id = targetList;
          doc.smartflo_sync_status = 'SYNCED';
          doc.smartflo_sync_error = null;
          doc.smartflo_last_synced_at = new Date();
          if (!doc.smartflo_dial_status) doc.smartflo_dial_status = 'READY';
          await doc.save();
        }
      }
    }

    const hasProcessing = batchResults.some((b) => b.status === 'processing');
    const finalStatus = failed === 0 && !hasProcessing
      ? 'completed'
      : (uploaded > 0 ? 'partial' : 'partial');

    log.status = hasProcessing ? 'processing' : finalStatus;
    log.uploaded = uploaded;
    log.failed = failed;
    log.batch_results = batchResults;
    await log.save();

    await writeDialerAudit({
      actor: changedBy,
      action: failed > 0 && uploaded === 0 ? 'sync.failed' : 'sync.completed',
      entity: 'sync',
      entityId: syncId,
      metadata: {
        uploaded,
        failed,
        alreadySynced: stats.alreadySynced,
        status: log.status,
      },
    });

    console.log(JSON.stringify({
      service: 'smartflo',
      operation: 'syncAll',
      syncId,
      total: stats.total,
      uploaded,
      failed,
      alreadySynced: stats.alreadySynced,
      invalid: stats.invalid,
      remoteMatched,
      status: log.status,
    }));

    return {
      success: failed === 0 && !hasProcessing,
      syncId,
      total: stats.total,
      eligible: stats.eligible,
      uploaded,
      alreadySynced: stats.alreadySynced,
      invalid: stats.invalid,
      failed,
      skipped: stats.alreadySynced,
      status: hasProcessing ? 'PROCESSING' : (failed === 0 ? 'COMPLETED' : 'PARTIAL'),
      batchIds,
      batchResults,
      invalidRows,
    };
  };

  activeSyncAllPromise = run();
  try {
    return await activeSyncAllPromise;
  } finally {
    activeSyncAllPromise = null;
  }
};

/**
 * Upload one ZentroFLOW opportunity to the configured Smartflo list.
 * @param {string} opportunityId
 * @param {{ resync?: boolean }} [options]
 */
export const syncOpportunityToSmartflo = async (opportunityId, options = {}) => {
  const { resync = false } = options;
  const opportunity = await findOpportunityByDialerId(opportunityId);
  if (!opportunity) throw new ApiError(404, 'LEAD_NOT_FOUND', 'ZentroFLOW lead not found');

  if (!resync && isAlreadySynced(opportunity)) {
    return {
      opportunity_id: opportunity.opportunity_id,
      lead_id: opportunity.lead_id,
      smartflo_lead_id: opportunity.smartflo_lead_id,
      smartflo_lead_list_id: opportunity.smartflo_lead_list_id,
      smartflo_sync_status: 'SYNCED',
      result: 'already_synced',
      skipped: true,
    };
  }

  const customer = await Customer.findOne({ customer_id: opportunity.customer_id });
  if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found for this lead');

  const targetList = listId();
  let row;
  try {
    row = mapZentroflowToSmartfloLead(opportunity, customer);
  } catch (err) {
    await markFailed(opportunity, err.message);
    throw err;
  }

  opportunity.smartflo_sync_status = 'SYNCING';
  opportunity.smartflo_sync_error = null;
  await opportunity.save();

  try {
    const response = await uploadSingleSmartfloLead(row, targetList);
    let remoteId = extractSmartfloLeadId(response);
    if (!remoteId) {
      const remoteLeads = await fetchLeadsInList(targetList).catch(() => []);
      const match = findRemoteLead(remoteLeads, opportunity, customer);
      remoteId = firstString(match?.id, match?.lead_id);
    }

    opportunity.smartflo_lead_id = remoteId || opportunity.smartflo_lead_id || null;
    opportunity.smartflo_lead_list_id = targetList;
    opportunity.smartflo_sync_status = 'SYNCED';
    opportunity.smartflo_sync_error = null;
    opportunity.smartflo_last_synced_at = new Date();
    if (!opportunity.smartflo_dial_status) opportunity.smartflo_dial_status = 'READY';
    await opportunity.save();

    console.log(JSON.stringify({
      service: 'smartflo',
      operation: 'syncLead',
      leadId: opportunity.opportunity_id,
      smartfloListId: targetList,
      status: 'success',
      resync: Boolean(resync),
    }));

    return {
      opportunity_id: opportunity.opportunity_id,
      lead_id: opportunity.lead_id,
      smartflo_lead_id: opportunity.smartflo_lead_id,
      smartflo_lead_list_id: targetList,
      smartflo_sync_status: 'SYNCED',
      result: 'synced',
      skipped: false,
    };
  } catch (err) {
    await markFailed(opportunity, err.message);
    console.log(JSON.stringify({
      service: 'smartflo',
      operation: 'syncLead',
      leadId: opportunity.opportunity_id,
      smartfloListId: targetList,
      status: 'failed',
      code: err.code,
    }));
    throw new ApiError(
      err.status || 502,
      err.code || 'SMARTFLO_LEAD_SYNC_FAILED',
      err.message && err.code !== 'INTERNAL_SERVER_ERROR'
        ? err.message
        : 'Unable to synchronize lead with Smartflo',
    );
  }
};

export const syncPendingLeads = async (limit = 100, changedBy = 'System') => {
  const pending = await Opportunity.find({
    $or: [
      { smartflo_sync_status: { $in: [null, 'PENDING', 'FAILED'] } },
      { smartflo_sync_status: { $exists: false } },
    ],
  }).limit(Math.min(Number(limit) || 100, BATCH_SIZE));

  const results = [];
  for (const opp of pending) {
    try {
      results.push(await syncOpportunityToSmartflo(opp.opportunity_id));
    } catch (err) {
      results.push({
        opportunity_id: opp.opportunity_id,
        smartflo_sync_status: 'FAILED',
        error: err.message,
      });
    }
  }
  await writeDialerAudit({
    actor: changedBy,
    action: 'sync.pending',
    entity: 'sync',
    entityId: null,
    metadata: { total: pending.length },
  });
  return { total: pending.length, results };
};

export const syncFailedLeads = async (limit = 200, changedBy = 'System') => {
  const failed = await Opportunity.find({ smartflo_sync_status: 'FAILED' })
    .limit(Math.min(Number(limit) || 200, BATCH_SIZE));
  const syncId = randomUUID();
  const results = [];
  for (const opp of failed) {
    try {
      results.push(await syncOpportunityToSmartflo(opp.opportunity_id));
    } catch (err) {
      results.push({
        opportunity_id: opp.opportunity_id,
        smartflo_sync_status: 'FAILED',
        error: err.message,
      });
    }
  }
  const uploaded = results.filter((r) => r.smartflo_sync_status === 'SYNCED' || r.result === 'synced').length;
  const failedCount = results.length - uploaded;
  await SmartfloSyncLog.create({
    sync_id: syncId,
    sync_type: 'dialer_retry',
    status: failedCount === 0 ? 'completed' : (uploaded > 0 ? 'partial' : 'partial'),
    total_leads: failed.length,
    eligible: failed.length,
    uploaded,
    failed: failedCount,
    created_by: changedBy,
  });
  await writeDialerAudit({
    actor: changedBy,
    action: 'sync.retry_failed',
    entity: 'sync',
    entityId: syncId,
    metadata: { total: failed.length, uploaded, failed: failedCount },
  });
  return {
    syncId,
    total: failed.length,
    uploaded,
    failed: failedCount,
    results,
    status: failedCount === 0 ? 'COMPLETED' : 'PARTIAL',
  };
};

export const syncSelectedLeads = async (ids = [], changedBy = 'System', options = {}) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'leadIds is required');
  }
  const { resync = false } = options;
  const syncId = randomUUID();
  const results = [];
  for (const id of ids) {
    try {
      results.push(await syncOpportunityToSmartflo(id, { resync }));
    } catch (err) {
      results.push({ opportunity_id: id, smartflo_sync_status: 'FAILED', error: err.message, result: 'failed' });
    }
  }
  const uploaded = results.filter((r) => r.result === 'synced').length;
  const alreadySynced = results.filter((r) => r.result === 'already_synced' || r.skipped).length;
  const failedCount = results.filter((r) => r.smartflo_sync_status === 'FAILED' || r.result === 'failed').length;
  await SmartfloSyncLog.create({
    sync_id: syncId,
    sync_type: 'dialer_selected',
    status: failedCount === 0 ? 'completed' : 'partial',
    total_leads: ids.length,
    eligible: ids.length,
    uploaded,
    failed: failedCount,
    already_synced: alreadySynced,
    skipped: alreadySynced,
    created_by: changedBy,
  });
  await writeDialerAudit({
    actor: changedBy,
    action: 'sync.selected',
    entity: 'sync',
    entityId: syncId,
    metadata: { total: ids.length, uploaded, failed: failedCount, alreadySynced, resync },
  });
  return {
    success: failedCount === 0,
    syncId,
    total: ids.length,
    synced: uploaded,
    uploaded,
    failed: failedCount,
    alreadySynced,
    skipped: alreadySynced,
    results,
    status: failedCount === 0 ? 'COMPLETED' : 'PARTIAL',
  };
};

/** GET /dialer/sync-jobs/:syncId — map wishlist jobId → SmartfloSyncLog.sync_id */
export const getSyncJobById = async (syncId) => {
  if (!syncId?.trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'syncId is required');
  }
  const log = await SmartfloSyncLog.findOne({ sync_id: syncId.trim() }).lean();
  if (!log) throw new ApiError(404, 'SYNC_JOB_NOT_FOUND', 'Sync job not found');
  return {
    syncId: log.sync_id,
    jobId: log.sync_id,
    syncType: log.sync_type,
    status: String(log.status || '').toUpperCase(),
    totalLeads: log.total_leads,
    eligible: log.eligible,
    uploaded: log.uploaded,
    failed: log.failed,
    skipped: log.skipped,
    alreadySynced: log.already_synced,
    invalid: log.invalid,
    batchResults: log.batch_results || [],
    createdBy: log.created_by,
    createdAt: log.created_at,
    updatedAt: log.updated_at,
  };
};

export const compareLocalAndRemoteLead = async (opportunityId) => {
  const opportunity = await findOpportunityByDialerId(opportunityId);
  if (!opportunity) throw new ApiError(404, 'LEAD_NOT_FOUND', 'ZentroFLOW lead not found');
  const customer = await Customer.findOne({ customer_id: opportunity.customer_id }).lean();
  const remoteLeads = await fetchLeadsInList();
  const match = findRemoteLead(remoteLeads, opportunity, customer);
  return {
    local: {
      opportunity_id: opportunity.opportunity_id,
      lead_id: opportunity.lead_id,
      smartflo_lead_id: opportunity.smartflo_lead_id,
      smartflo_sync_status: opportunity.smartflo_sync_status,
      smartflo_dial_status: opportunity.smartflo_dial_status,
      smartflo_disposition: opportunity.smartflo_disposition,
    },
    remote: match ? {
      id: firstString(match.id, match.lead_id),
      field_0: match.field_0 ?? null,
      field_1: match.field_1 ?? null,
      status: firstString(match.status, match.dial_status, match.lead_status),
    } : null,
    matched: Boolean(match),
  };
};
