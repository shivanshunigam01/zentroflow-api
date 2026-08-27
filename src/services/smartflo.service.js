import axios from 'axios';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import { isValidMobile, normalizeMobile } from '../helpers/mobile.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import Customer from '../models/Customer.js';
import Opportunity from '../models/Opportunity.js';
import SmartfloSyncLog from '../models/SmartfloSyncLog.js';
import { smartfloGet, smartfloPost } from './smartflo/smartflo.client.js';

const BATCH_SIZE = 500;

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
  return smartfloPost(
    `/broadcast/leads/${leadListId}`,
    { data, duplicate_option: 'skip' },
    'uploadLeadBatch',
  );
};

/** GET /v1/broadcast/batch_status/{batchId} */
export const getSmartfloBatchStatus = async (batchId) => {
  validateSmartfloConfig();
  if (!batchId?.trim()) {
    throw new ApiError(400, 'INVALID_BATCH_ID', 'batchId is required');
  }
  return smartfloGet(
    `/broadcast/batch_status/${encodeURIComponent(batchId.trim())}`,
    undefined,
    'batchStatus',
  );
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
// Click-to-Call Support API (IVR outbound)
// Docs: https://docs.smartflo.tatatelebusiness.com/reference/v1click_to_call_support
//
// Destination (IVR / agent / department) is bound to SMARTFLO_CLICK_TO_CALL_API_KEY
// in the Smartflo panel — do NOT send ivrId in the request body.
//
// Auth: Authorization: Bearer SMARTFLO_API_TOKEN
// Body: { api_key, customer_number, async: 1, caller_id?, custom_identifier? }
// ---------------------------------------------------------------------------

const maskPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

const alphanumericId = (value) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);

/** Validate Click-to-Call Support env (token + Support API key). IVR destination lives on the key. */
export const validateClickToCallConfig = () => {
  if (!env.SMARTFLO_API_TOKEN?.trim()) {
    throw new ApiError(503, 'SMARTFLO_NOT_CONFIGURED', 'Set SMARTFLO_API_TOKEN in server .env');
  }
  if (!env.SMARTFLO_CLICK_TO_CALL_API_KEY?.trim()) {
    throw new ApiError(503, 'SMARTFLO_CTC_NOT_CONFIGURED', 'Set SMARTFLO_CLICK_TO_CALL_API_KEY in server .env');
  }
};

export const isClickToCallConfigured = () => Boolean(
  env.SMARTFLO_API_TOKEN?.trim() && env.SMARTFLO_CLICK_TO_CALL_API_KEY?.trim(),
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
    throw new ApiError(400, 'SMARTFLO_INVALID_NUMBER', 'phoneNumber is required', 'phoneNumber');
  }

  const normalized = normalizePhoneForSmartfloCall(phoneNumber);
  // Smartflo CTC: customer_number must be 10–12 digits (91XXXXXXXXXX = 12)
  if (!/^\d{10,12}$/.test(normalized) || !/^91[6-9]\d{9}$/.test(normalized)) {
    throw new ApiError(
      400,
      'SMARTFLO_INVALID_NUMBER',
      'phoneNumber must be a valid Indian mobile (10-digit / 91XXXXXXXXXX)',
      'phoneNumber',
    );
  }

  return normalized;
};

/**
 * Documented Click-to-Call Support body.
 * Do not send ivrId — destination is configured on the Support API key in Smartflo.
 */
export function buildClickToCallPayload(customerNumber, meta = {}) {
  const payload = {
    api_key: env.SMARTFLO_CLICK_TO_CALL_API_KEY.trim(),
    customer_number: customerNumber,
    async: 1,
  };

  if (env.SMARTFLO_CALLER_ID?.trim()) {
    payload.caller_id = env.SMARTFLO_CALLER_ID.trim();
  }

  const custom = {};
  const oppId = alphanumericId(meta.opportunityId);
  if (oppId) custom.opportunity_id = oppId;
  const source = alphanumericId(meta.source || 'zentroflow');
  if (source) custom.source = source;
  if (Object.keys(custom).length) {
    payload.custom_identifier = custom;
  }

  return payload;
}

export const getClickToCallUrl = () => {
  const base = (env.SMARTFLO_API_BASE_URL?.trim()
    || `${(env.SMARTFLO_BASE_URL || 'https://api-smartflo.tatateleservices.com').replace(/\/+$/, '')}/v1`
  ).replace(/\/+$/, '');
  // Prefer path-only endpoint under v1 API root
  let path = env.SMARTFLO_CLICK_TO_CALL_ENDPOINT || '/v1/click_to_call_support';
  if (!path.startsWith('/')) path = `/${path}`;
  // If base already ends with /v1 and path starts with /v1/, drop duplicate
  if (/\/v\d+$/i.test(base) && /^\/v\d+\//i.test(path)) {
    path = path.replace(/^\/v\d+/, '');
  }
  return `${base}${path}`;
};

/** Map Smartflo CTC errors → stable ZentroFLOW codes (preserve Smartflo message in logs). */
export const mapClickToCallError = (err) => {
  const status = err.response?.status;
  const data = err.response?.data;
  const fieldMsg = Array.isArray(data?.customer_number) ? data.customer_number[0] : null;
  const rawMessage = String(
    fieldMsg
    || data?.message
    || data?.error
    || (typeof data === 'string' ? data : '')
    || err.message
    || 'Smartflo click-to-call failed',
  ).trim();
  const lower = rawMessage.toLowerCase();

  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
    return { code: 'SMARTFLO_TIMEOUT', status: 504, message: 'Smartflo request timed out', smartfloMessage: rawMessage };
  }
  if (/caller[_\s-]?id|provide a valid caller/i.test(lower)) {
    return { code: 'SMARTFLO_INVALID_CALLER_ID', status: 400, message: 'Invalid or unconfigured Smartflo caller ID (DID)', smartfloMessage: rawMessage };
  }
  if (/customer number|between 10 and 12|invalid number|destination number/i.test(lower)) {
    return { code: 'SMARTFLO_INVALID_NUMBER', status: 400, message: 'Invalid customer number for Smartflo', smartfloMessage: rawMessage };
  }
  if (/inactive|account.*disabled|account.*suspend/i.test(lower)) {
    return { code: 'SMARTFLO_ACCOUNT_INACTIVE', status: 403, message: 'Smartflo account is inactive', smartfloMessage: rawMessage };
  }
  if (
    status === 401
    || status === 403
    || /api[_\s-]?key|unauthorized|invalid details|authentication|token/i.test(lower)
  ) {
    return { code: 'SMARTFLO_INVALID_API_KEY', status: status === 403 ? 403 : 401, message: 'Invalid Smartflo API token or Click-to-Call Support API key', smartfloMessage: rawMessage };
  }
  if (/unable to process|originate failed|failed/i.test(lower)) {
    return { code: 'SMARTFLO_CALL_FAILED', status: 502, message: rawMessage || 'Smartflo could not process the call request', smartfloMessage: rawMessage };
  }
  return {
    code: 'SMARTFLO_CALL_FAILED',
    status: status && status >= 400 ? Math.min(status, 502) : 502,
    message: rawMessage || 'Smartflo call request failed',
    smartfloMessage: rawMessage,
  };
};

/**
 * Trigger Smartflo Click-to-Call Support (customer-first → destination on API key).
 * Success only means the request was accepted — store ref_id for webhook correlation.
 */
export const initiateClickToCall = async (phoneNumber, meta = {}) => {
  validateClickToCallConfig();
  const normalized = validateClickToCallPhone(phoneNumber);
  const url = getClickToCallUrl();
  const payload = buildClickToCallPayload(normalized, meta);

  console.log(JSON.stringify({
    service: 'smartflo',
    operation: 'click_to_call_support.request',
    url,
    phoneMasked: maskPhone(normalized),
    hasCallerId: Boolean(payload.caller_id),
    hasCustomIdentifier: Boolean(payload.custom_identifier),
    opportunityId: meta.opportunityId ? alphanumericId(meta.opportunityId) : null,
  }));

  let data;
  let httpStatus;
  try {
    const response = await axios.post(url, payload, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.SMARTFLO_API_TOKEN.trim()}`,
      },
      timeout: 30000,
    });
    data = response.data;
    httpStatus = response.status;
  } catch (err) {
    const mapped = mapClickToCallError(err);
    console.error(JSON.stringify({
      service: 'smartflo',
      operation: 'click_to_call_support.error',
      code: mapped.code,
      httpStatus: err.response?.status || null,
      smartfloMessage: mapped.smartfloMessage,
      phoneMasked: maskPhone(normalized),
    }));
    throw new ApiError(mapped.status, mapped.code, mapped.message, 'phoneNumber');
  }

  if (data?.success === false) {
    const mapped = mapClickToCallError({
      response: { status: httpStatus || 400, data },
      message: data?.message || 'Unable to process this request',
    });
    console.error(JSON.stringify({
      service: 'smartflo',
      operation: 'click_to_call_support.rejected',
      code: mapped.code,
      httpStatus,
      smartfloMessage: mapped.smartfloMessage,
      phoneMasked: maskPhone(normalized),
    }));
    throw new ApiError(mapped.status, mapped.code, mapped.message, 'phoneNumber');
  }

  const refId = String(data?.ref_id || data?.refId || '').trim() || null;

  console.log(JSON.stringify({
    service: 'smartflo',
    operation: 'click_to_call_support.accepted',
    httpStatus,
    refId,
    phoneMasked: maskPhone(normalized),
    message: data?.message || null,
  }));

  // Persist acceptance row for webhook correlation (answered / missed / completed / failed)
  try {
    const DialerCall = (await import('../models/DialerCall.js')).default;
    const Opportunity = (await import('../models/Opportunity.js')).default;
    let opportunity = null;
    if (meta.opportunityId) {
      opportunity = await Opportunity.findOne({
        $or: [
          { opportunity_id: meta.opportunityId },
          { lead_id: meta.opportunityId },
        ],
      });
    }
    await DialerCall.create({
      opportunity_id: opportunity?.opportunity_id || meta.opportunityId || null,
      lead_id: opportunity?.lead_id || null,
      customer_id: opportunity?.customer_id || null,
      customer_number: normalized,
      smartflo_ref_id: refId,
      smartflo_uuid: refId,
      caller_id: payload.caller_id || env.SMARTFLO_CALLER_ID || null,
      direction: 'outbound',
      status: 'ACCEPTED',
      raw_event_ref: 'click_to_call_support',
    });
  } catch (persistErr) {
    console.error(JSON.stringify({
      service: 'smartflo',
      operation: 'click_to_call_support.persist',
      status: 'failed',
      message: persistErr.message,
      refId,
    }));
  }

  return {
    success: true,
    message: data?.message || 'Originate successfully queued',
    phoneNumber: normalized,
    call: {
      refId,
      phoneNumber: normalized,
      status: 'ACCEPTED',
    },
  };
};

// ---------------------------------------------------------------------------
// Normal / Agent Click-to-Call — prefers Support API key when configured
// (same /v1/click_to_call_support as IVR; routing is bound to the API key in panel).
// Falls back to Bearer /v1/click_to_call when only JWT + agent_number are set.
//
// curl -X POST http://localhost:8787/api/v1/smartflo/agent-call \
//   -H "Content-Type: application/json" \
//   -H "Authorization: Bearer YOUR_JWT" \
//   -d '{"phoneNumber":"917247650665"}'
// ---------------------------------------------------------------------------

export const validateDirectAgentCallConfig = () => {
  if (env.SMARTFLO_AGENT_CALL_API_KEY?.trim()) {
    if (!env.SMARTFLO_CALLER_ID?.trim()) {
      throw new ApiError(503, 'SMARTFLO_AGENT_CTC_NOT_CONFIGURED', 'Set SMARTFLO_CALLER_ID in server .env');
    }
    return;
  }
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
  (env.SMARTFLO_AGENT_CALL_API_KEY?.trim() && env.SMARTFLO_CALLER_ID?.trim())
  || (env.SMARTFLO_API_TOKEN?.trim()
    && env.SMARTFLO_AGENT_NUMBER?.trim()
    && env.SMARTFLO_CALLER_ID?.trim()),
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

/** Support API payload for agent/normal call (api_key routed to agent in Smartflo panel). */
export function buildAgentSupportCallPayload(customerNumber) {
  const payload = {
    api_key: env.SMARTFLO_AGENT_CALL_API_KEY.trim(),
    customer_number: customerNumber,
    async: 1,
  };
  if (env.SMARTFLO_CALLER_ID?.trim()) {
    payload.caller_id = env.SMARTFLO_CALLER_ID.trim();
  }
  return payload;
}

export const getDirectAgentCallUrl = () => {
  const base = env.SMARTFLO_BASE_URL.replace(/\/+$/, '');
  const endpoint = env.SMARTFLO_DIRECT_CALL_ENDPOINT || '/v1/click_to_call';
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

/** Direct agent / normal click-to-call — rings agent first, then connects customer. */
export const initiateDirectAgentCall = async (phoneNumber, meta = {}) => {
  validateDirectAgentCallConfig();

  // Prefer Support API when agent API Connect key is set (matches IVR pattern).
  if (env.SMARTFLO_AGENT_CALL_API_KEY?.trim()) {
    const normalized = validateClickToCallPhone(phoneNumber);
    const url = getClickToCallUrl();
    const payload = buildAgentSupportCallPayload(normalized);

    console.log('[Smartflo Agent CTC] Incoming request body:', { phoneNumber, ...meta });
    console.log('[Smartflo Agent CTC] Mode: click_to_call_support (agent API key)');
    console.log('[Smartflo Agent CTC] Normalized phone number:', normalized);
    console.log('[Smartflo Agent CTC] Smartflo API URL:', url);
    console.log('[Smartflo Agent CTC] Smartflo request payload:', {
      ...payload,
      api_key: payload.api_key ? '***redacted***' : undefined,
    });

    try {
      const { data, status } = await axios.post(url, payload, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(env.SMARTFLO_API_TOKEN?.trim()
            ? { Authorization: `Bearer ${env.SMARTFLO_API_TOKEN.trim()}` }
            : {}),
        },
        timeout: 30000,
      });

      console.log(JSON.stringify({
        service: 'smartflo',
        operation: 'agent_click_to_call_support.accepted',
        httpStatus: status,
        refId: data?.ref_id || null,
      }));

      return {
        success: data?.success !== false,
        message: data?.message ?? 'Call originated successfully',
        phoneNumber: normalized,
        agentNumber: env.SMARTFLO_AGENT_NUMBER || env.SMARTFLO_CALLER_ID,
        call: {
          refId: data?.ref_id || null,
          phoneNumber: normalized,
          status: 'ACCEPTED',
        },
      };
    } catch (err) {
      const mapped = mapClickToCallError(err);
      console.error(JSON.stringify({
        service: 'smartflo',
        operation: 'agent_click_to_call_support.error',
        code: mapped.code,
        smartfloMessage: mapped.smartfloMessage,
      }));
      throw new ApiError(mapped.status, mapped.code, mapped.message, 'phoneNumber');
    }
  }

  const destination = toDirectCallDestination(phoneNumber);
  const url = getDirectAgentCallUrl();
  const payload = buildDirectAgentCallPayload(destination);

  console.log('[Smartflo Agent CTC] Incoming request body:', { phoneNumber, ...meta });
  console.log('[Smartflo Agent CTC] Mode: /v1/click_to_call (Bearer)');
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

