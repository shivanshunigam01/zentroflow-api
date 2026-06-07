import axios from 'axios';
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

// ---------------------------------------------------------------------------
// Click-to-Call API (official API Connect — form-urlencoded)
// Confirmed field mapping from Smartflo panel UI (no browser _token / CSRF).
//
// curl -X POST http://localhost:8787/api/v1/smartflo/call \
//   -H "Content-Type: application/json" \
//   -H "Authorization: Bearer YOUR_JWT" \
//   -d '{"phoneNumber":"919893654192"}'
// ---------------------------------------------------------------------------

/** Validate Click-to-Call env (API key + agent/caller/user ids). */
export const validateClickToCallConfig = () => {
  if (!env.SMARTFLO_CLICK_TO_CALL_API_KEY?.trim()) {
    throw new ApiError(503, 'SMARTFLO_CTC_NOT_CONFIGURED', 'Set SMARTFLO_CLICK_TO_CALL_API_KEY in server .env');
  }
  if (!env.SMARTFLO_CTC_CALLER_ID?.trim()) {
    throw new ApiError(503, 'SMARTFLO_CTC_NOT_CONFIGURED', 'Set SMARTFLO_CTC_CALLER_ID in server .env');
  }
  if (!env.SMARTFLO_CTC_AGENT_ID?.trim()) {
    throw new ApiError(503, 'SMARTFLO_CTC_NOT_CONFIGURED', 'Set SMARTFLO_CTC_AGENT_ID in server .env');
  }
  if (!env.SMARTFLO_USER_ID?.trim()) {
    throw new ApiError(503, 'SMARTFLO_CTC_NOT_CONFIGURED', 'Set SMARTFLO_USER_ID in server .env');
  }
};

export const isClickToCallConfigured = () => Boolean(
  env.SMARTFLO_CLICK_TO_CALL_API_KEY?.trim()
  && env.SMARTFLO_CTC_CALLER_ID?.trim()
  && env.SMARTFLO_CTC_AGENT_ID?.trim()
  && env.SMARTFLO_USER_ID?.trim(),
);

/**
 * Normalize to 91XXXXXXXXXX for Smartflo outbound calls.
 * Accepts +91, 0-prefix, or bare 10-digit Indian mobile.
 */
export const normalizePhoneForSmartfloCall = (phoneNumber = '') => {
  let digits = String(phoneNumber).replace(/\D/g, '');

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = `91${digits.slice(1)}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // already 91XXXXXXXXXX
  } else if (digits.length > 12 && digits.startsWith('91')) {
    digits = digits.slice(0, 12);
  }

  return digits;
};

export const validateClickToCallPhone = (phoneNumber) => {
  if (!phoneNumber || !String(phoneNumber).trim()) {
    throw new ApiError(400, 'INVALID_PHONE', 'phoneNumber is required', 'phoneNumber');
  }

  const normalized = normalizePhoneForSmartfloCall(phoneNumber);
  if (!/^91[6-9]\d{9}$/.test(normalized)) {
    throw new ApiError(
      400,
      'INVALID_PHONE',
      'phoneNumber must be a valid Indian mobile (+91 / 10-digit / 91XXXXXXXXXX)',
      'phoneNumber',
    );
  }

  return normalized;
};

/**
 * Build Smartflo Click-to-Call form body (x-www-form-urlencoded).
 * Maps confirmed Smartflo UI fields — no browser session _token.
 */
export function buildClickToCallPayload(normalizedPhone) {
  return {
    phone_ctc: normalizedPhone,
    ctc_caller_id: env.SMARTFLO_CTC_CALLER_ID.trim(),
    ctc_agent_id: env.SMARTFLO_CTC_AGENT_ID.trim(),
    user_id: env.SMARTFLO_USER_ID.trim(),
  };
}

export const getClickToCallRequestHeaders = () => {
  const apiKey = env.SMARTFLO_CLICK_TO_CALL_API_KEY.trim();
  return {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    api_key: apiKey,
  };
};

export const redactClickToCallHeaders = (headers) => ({
  ...headers,
  api_key: headers.api_key ? '***redacted***' : undefined,
  Authorization: headers.Authorization ? '***redacted***' : undefined,
});

export const getClickToCallUrl = () => {
  const base = env.SMARTFLO_BASE_URL.replace(/\/+$/, '');
  const path = env.SMARTFLO_CLICK_TO_CALL_ENDPOINT.startsWith('/')
    ? env.SMARTFLO_CLICK_TO_CALL_ENDPOINT
    : `/${env.SMARTFLO_CLICK_TO_CALL_ENDPOINT}`;
  return `${base}${path}`;
};

/** Trigger Smartflo click-to-call for one lead phone number. */
export const initiateClickToCall = async (phoneNumber, meta = {}) => {
  validateClickToCallConfig();
  const normalized = validateClickToCallPhone(phoneNumber);
  const url = getClickToCallUrl();
  const payload = buildClickToCallPayload(normalized);
  const formBody = new URLSearchParams(payload).toString();
  const headers = getClickToCallRequestHeaders();

  console.log('[Smartflo CTC] Incoming request body:', { phoneNumber, ...meta });
  console.log('[Smartflo CTC] Normalized phone number:', normalized);
  console.log('[Smartflo CTC] Final URL:', url);
  console.log('[Smartflo CTC] Final payload:', payload);
  console.log('[Smartflo CTC] Request headers:', redactClickToCallHeaders(headers));

  try {
    const { data, status } = await axios.post(url, formBody, {
      headers,
      timeout: 30000,
    });

    console.log('[Smartflo CTC] Smartflo success response:', { status, data });

    return {
      success: data?.success !== false,
      message: data?.message ?? data?.msg ?? 'Call originated successfully',
      phoneNumber: normalized,
      smartflo: data,
    };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error('[Smartflo CTC] Smartflo error response:', { status, data, message: err.message });

    const message = (typeof data === 'string' ? data : null)
      || data?.message
      || data?.error
      || err.message
      || 'Smartflo click-to-call failed';

    throw new ApiError(502, 'SMARTFLO_CTC_FAILED', message, 'phoneNumber');
  }
};

// ---------------------------------------------------------------------------
// Direct Agent Click-to-Call API (separate from IVR Support API above)
// Docs: https://docs.smartflo.tatatelebusiness.com/reference/v1click_to_call
//
// curl -X POST http://localhost:8787/api/v1/smartflo/agent-call \
//   -H "Content-Type: application/json" \
//   -H "Authorization: Bearer YOUR_JWT" \
//   -d '{"phoneNumber":"917247650665"}'
// ---------------------------------------------------------------------------

export const validateDirectAgentCallConfig = () => {
  if (!env.SMARTFLO_API_TOKEN?.trim()) {
    throw new ApiError(503, 'SMARTFLO_AGENT_CTC_NOT_CONFIGURED', 'Set SMARTFLO_API_TOKEN in server .env');
  }
  if (!env.SMARTFLO_AGENT_NUMBER?.trim()) {
    throw new ApiError(503, 'SMARTFLO_AGENT_CTC_NOT_CONFIGURED', 'Set SMARTFLO_AGENT_NUMBER in server .env');
  }
  if (!env.SMARTFLO_CALLER_ID?.trim()) {
    throw new ApiError(503, 'SMARTFLO_AGENT_CTC_NOT_CONFIGURED', 'Set SMARTFLO_CALLER_ID in server .env');
  }
};

export const isDirectAgentCallConfigured = () => Boolean(
  env.SMARTFLO_API_TOKEN?.trim()
  && env.SMARTFLO_AGENT_NUMBER?.trim()
  && env.SMARTFLO_CALLER_ID?.trim(),
);

/** 10-digit destination for /v1/click_to_call */
export const toDirectCallDestination = (phoneNumber) => {
  const normalized = validateClickToCallPhone(phoneNumber);
  return normalized.slice(-10);
};

export function buildDirectAgentCallPayload(destinationNumber) {
  return {
    agent_number: env.SMARTFLO_AGENT_NUMBER.trim(),
    destination_number: destinationNumber,
    caller_id: env.SMARTFLO_CALLER_ID.trim(),
    async: 1,
  };
}

export const getDirectAgentCallUrl = () => {
  const base = env.SMARTFLO_BASE_URL.replace(/\/+$/, '');
  const endpoint = env.SMARTFLO_DIRECT_CALL_ENDPOINT || '/v1/click_to_call';
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

/** Direct agent click-to-call — rings agent first, then connects customer. */
export const initiateDirectAgentCall = async (phoneNumber, meta = {}) => {
  validateDirectAgentCallConfig();
  const destination = toDirectCallDestination(phoneNumber);
  const url = getDirectAgentCallUrl();
  const payload = buildDirectAgentCallPayload(destination);

  console.log('[Smartflo Agent CTC] Incoming request body:', { phoneNumber, ...meta });
  console.log('[Smartflo Agent CTC] Destination number:', destination);
  console.log('[Smartflo Agent CTC] Smartflo API URL:', url);
  console.log('[Smartflo Agent CTC] Smartflo request payload:', payload);

  try {
    const { data, status } = await axios.post(url, payload, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.SMARTFLO_API_TOKEN}`,
      },
      timeout: 30000,
    });

    console.log('[Smartflo Agent CTC] Smartflo success response:', { status, data });

    return {
      success: data?.success !== false,
      message: data?.message ?? 'Call originated successfully',
      phoneNumber: destination,
      agentNumber: env.SMARTFLO_AGENT_NUMBER,
      smartflo: data,
    };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error('[Smartflo Agent CTC] Smartflo error response:', { status, data, message: err.message });

    const message = data?.message
      || data?.error
      || err.message
      || 'Smartflo direct agent call failed';

    throw new ApiError(502, 'SMARTFLO_AGENT_CTC_FAILED', message, 'phoneNumber');
  }
};

