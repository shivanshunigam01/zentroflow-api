import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { isValidMobile, normalizeMobile } from '../helpers/mobile.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import Customer from '../models/Customer.js';
import Opportunity from '../models/Opportunity.js';
import SmartfloSyncLog from '../models/SmartfloSyncLog.js';

const BATCH_SIZE = 500;

const smartfloHeaders = () => ({
  Authorization: `Bearer ${env.SMARTFLO_API_TOKEN}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

/** Ensure Smartflo credentials are configured before any API call. */
export const validateSmartfloConfig = () => {
  if (!env.SMARTFLO_API_TOKEN?.trim()) {
    throw new ApiError(503, 'SMARTFLO_NOT_CONFIGURED', 'Set SMARTFLO_API_TOKEN in server .env');
  }
  if (!env.SMARTFLO_LEAD_LIST_ID?.trim()) {
    throw new ApiError(503, 'SMARTFLO_NOT_CONFIGURED', 'Set SMARTFLO_LEAD_LIST_ID in server .env');
  }
};

export const isSmartfloConfigured = () => Boolean(
  env.SMARTFLO_API_TOKEN?.trim() && env.SMARTFLO_LEAD_LIST_ID?.trim(),
);

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** First segment of address or opportunity branch as city. */
const resolveCity = (customer, branchByCustomer) => {
  const fromAddress = customer.address?.split(',')[0]?.trim();
  if (fromAddress) return fromAddress;
  return branchByCustomer[customer.customer_id]?.trim() || '';
};

/**
 * Map DB customers → Smartflo lead rows.
 * field_0 = phone, field_1 = name, field_2 = email, field_3 = city (when present).
 * Skips rows with empty/invalid phone numbers.
 */
export const fetchLeadsForSmartflo = async () => {
  const [customers, opportunities] = await Promise.all([
    Customer.find().lean(),
    Opportunity.find().select('customer_id branch').lean(),
  ]);

  const branchByCustomer = {};
  for (const opp of opportunities) {
    if (opp.branch && !branchByCustomer[opp.customer_id]) {
      branchByCustomer[opp.customer_id] = opp.branch;
    }
  }

  const seenPhones = new Set();
  const mapped = [];
  let skipped = 0;

  for (const customer of customers) {
    const phone = normalizeMobile(customer.mobile);
    if (!phone || !isValidMobile(phone)) {
      skipped += 1;
      continue;
    }
    if (seenPhones.has(phone)) {
      skipped += 1;
      continue;
    }
    seenPhones.add(phone);

    const row = {
      field_0: phone,
      field_1: (customer.name || 'Lead').trim(),
    };

    const email = customer.email?.trim();
    if (email) row.field_2 = email;

    const city = resolveCity(customer, branchByCustomer);
    if (city) row.field_3 = city;

    mapped.push(row);
  }

  return { leads: mapped, skipped };
};

/** POST /v1/broadcast/leads/{LEAD_LIST_ID} */
export const uploadLeadBatch = async (leadListId, data) => {
  const url = `${env.SMARTFLO_BASE_URL.replace(/\/+$/, '')}/v1/broadcast/leads/${leadListId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: smartfloHeaders(),
    body: JSON.stringify({ data, duplicate_option: 'skip' }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.message || body?.error || `Smartflo upload failed (HTTP ${res.status})`;
    const err = new ApiError(502, 'SMARTFLO_UPLOAD_FAILED', message);
    err.smartfloResponse = body;
    throw err;
  }

  return body;
};

/** GET /v1/broadcast/batch_status/{batchId} */
export const getSmartfloBatchStatus = async (batchId) => {
  validateSmartfloConfig();
  if (!batchId?.trim()) {
    throw new ApiError(400, 'INVALID_BATCH_ID', 'batchId is required');
  }

  const url = `${env.SMARTFLO_BASE_URL.replace(/\/+$/, '')}/v1/broadcast/batch_status/${encodeURIComponent(batchId.trim())}`;
  const res = await fetch(url, { method: 'GET', headers: smartfloHeaders() });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      502,
      'SMARTFLO_STATUS_FAILED',
      body?.message || body?.error || `Smartflo batch status failed (HTTP ${res.status})`,
    );
  }

  return body;
};

const extractBatchId = (response) => (
  response?.batch_id
  ?? response?.batchId
  ?? response?.data?.batch_id
  ?? response?.data?.batchId
  ?? null
);

/**
 * Sync all DB leads to Smartflo in batches of 500.
 * Continues on batch failure; stores per-batch results.
 */
export const syncLeadsToSmartflo = async (changedBy = 'System') => {
  validateSmartfloConfig();

  const { leads, skipped } = await fetchLeadsForSmartflo();
  const batches = chunk(leads, BATCH_SIZE);
  const syncId = randomUUID();

  const log = await SmartfloSyncLog.create({
    sync_id: syncId,
    status: 'running',
    total_leads: leads.length,
    skipped,
    batch_results: [],
    created_by: changedBy,
  });

  const batchResults = [];
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    try {
      const response = await uploadLeadBatch(env.SMARTFLO_LEAD_LIST_ID, batch);
      const batchId = extractBatchId(response);
      const result = {
        batch_index: i + 1,
        batch_id: batchId,
        status: 'success',
        uploaded_count: batch.length,
        failed_count: 0,
        lead_count: batch.length,
        smartflo_response: response,
      };
      batchResults.push(result);
      uploaded += batch.length;
    } catch (err) {
      console.error(`[Smartflo] batch ${i + 1} failed:`, err.message);
      batchResults.push({
        batch_index: i + 1,
        batch_id: null,
        status: 'failed',
        uploaded_count: 0,
        failed_count: batch.length,
        lead_count: batch.length,
        smartflo_response: err.smartfloResponse ?? null,
        error: err.message,
      });
      failed += batch.length;
    }
  }

  const finalStatus = failed === 0 ? 'completed' : (uploaded > 0 ? 'partial' : 'partial');
  log.status = finalStatus;
  log.uploaded = uploaded;
  log.failed = failed;
  log.batch_results = batchResults;
  await log.save();

  return {
    success: failed === 0,
    syncId,
    totalLeads: leads.length,
    uploaded,
    failed,
    skipped,
    batchResults,
  };
};

export const getSyncLogByBatchId = async (batchId) => {
  const log = await SmartfloSyncLog.findOne({ 'batch_results.batch_id': batchId }).lean();
  if (!log) return null;
  const batch = log.batch_results.find((b) => b.batch_id === batchId);
  return { log, batch };
};
