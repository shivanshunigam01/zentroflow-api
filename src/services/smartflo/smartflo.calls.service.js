import DialerCall from '../../models/DialerCall.js';
import Opportunity from '../../models/Opportunity.js';
import { getPagination, paginationMeta } from '../../helpers/pagination.js';
import { smartfloGet } from './smartflo.client.js';
import { asArray, firstString } from './smartflo.helpers.js';
import { mapSmartfloStatus } from './smartflo.status.mapper.js';

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const normalizeCallRecord = (row = {}) => {
  const mapped = mapSmartfloStatus(firstString(row.status, row.call_status, row.hangup_cause));
  const disposition = mapSmartfloStatus(firstString(row.disposition, row.disposition_status, row.disposition_name));
  return {
    smartflo_call_id: firstString(row.call_id, row.callId, row.id),
    smartflo_uuid: firstString(row.uuid, row.unique_id, row.uniqueId, row.ref_id),
    smartflo_ref_id: firstString(row.ref_id, row.refId),
    customer_number: firstString(row.customer_number, row.destination, row.phone, row.field_0),
    campaign_id: firstString(row.campaign_id, row.campaignId),
    agent_id: firstString(row.agent_id, row.agentId, row.agent_number),
    agent_name: firstString(row.agent_name, row.agent, row.agentName),
    caller_id: firstString(row.caller_id, row.did),
    direction: firstString(row.direction, row.call_direction),
    status: mapped.mapped || firstString(row.status, row.call_status),
    disposition: disposition.mapped || firstString(row.disposition, row.disposition_status),
    disposition_code: firstString(row.disposition_id, row.disposition_status),
    start_time: toDate(row.start_time || row.started_at || row.call_start),
    end_time: toDate(row.end_time || row.ended_at || row.call_end),
    duration: Number(row.duration || row.billsec || 0) || null,
    recording_ref: firstString(row.recording, row.recording_url, row.recording_id),
  };
};

/** Mongo filter for GET /dialer/calls query params. */
export const buildCallsFilter = (query = {}) => {
  const filter = {};
  const and = [];

  if (query.campaignId) filter.campaign_id = String(query.campaignId).trim();
  if (query.agentId) filter.agent_id = String(query.agentId).trim();
  if (query.status) filter.status = String(query.status).trim();
  if (query.disposition) filter.disposition = String(query.disposition).trim();
  if (query.direction) filter.direction = String(query.direction).trim();

  const leadId = query.leadId?.trim();
  if (leadId) {
    and.push({ $or: [{ opportunity_id: leadId }, { lead_id: leadId }] });
  }

  const callId = query.callId?.trim();
  if (callId) {
    and.push({
      $or: [
        { smartflo_call_id: callId },
        { smartflo_uuid: callId },
        { smartflo_ref_id: callId },
      ],
    });
  }

  const search = query.search?.trim();
  if (search) {
    const re = new RegExp(escapeRegex(search), 'i');
    and.push({
      $or: [
        { customer_number: re },
        { agent_name: re },
        { agent_id: re },
        { smartflo_call_id: re },
        { smartflo_uuid: re },
        { smartflo_lead_id: re },
        { lead_id: re },
        { opportunity_id: re },
        { disposition: re },
        { status: re },
      ],
    });
  }

  const dateField = query.dateField === 'start_time' ? 'start_time' : 'created_at';
  const fromDate = toDate(query.fromDate || query.from);
  const toDateValue = toDate(query.toDate || query.to);
  if (fromDate || toDateValue) {
    filter[dateField] = {};
    if (fromDate) filter[dateField].$gte = fromDate;
    if (toDateValue) filter[dateField].$lte = toDateValue;
  }

  if (and.length) filter.$and = and;
  return filter;
};

/** Stable API shape for Auto Dialer dashboard (snake_case + camelCase aliases). */
export const serializeCallRecord = (row = {}) => {
  const id = row._id?.toString?.() ?? row._id ?? null;
  const startedAt = row.start_time ?? null;
  const answeredAt = row.answered_at ?? null;
  const endedAt = row.end_time ?? null;
  const createdAt = row.created_at ?? null;
  const updatedAt = row.updated_at ?? null;

  return {
    id,
    _id: id,
    opportunity_id: row.opportunity_id ?? null,
    lead_id: row.lead_id ?? null,
    leadId: row.lead_id ?? row.opportunity_id ?? null,
    customer_id: row.customer_id ?? null,
    customer_number: row.customer_number ?? null,
    customerPhone: row.customer_number ?? null,
    smartflo_call_id: row.smartflo_call_id ?? null,
    smartfloCallId: row.smartflo_call_id ?? null,
    smartflo_uuid: row.smartflo_uuid ?? null,
    smartflo_lead_id: row.smartflo_lead_id ?? null,
    smartfloLeadId: row.smartflo_lead_id ?? null,
    campaign_id: row.campaign_id ?? null,
    campaignId: row.campaign_id ?? null,
    agent_id: row.agent_id ?? null,
    agentId: row.agent_id ?? null,
    agent_name: row.agent_name ?? null,
    caller_id: row.caller_id ?? null,
    callerId: row.caller_id ?? null,
    direction: row.direction ?? null,
    status: row.status ?? null,
    disposition: row.disposition ?? null,
    disposition_code: row.disposition_code ?? null,
    sub_disposition: row.sub_disposition ?? null,
    disposition_note: row.disposition_note ?? null,
    duration: row.duration ?? null,
    start_time: startedAt,
    startedAt,
    answered_at: answeredAt,
    answeredAt,
    end_time: endedAt,
    endedAt,
    recording_ref: row.recording_ref ?? null,
    recordingUrl: row.recording_ref ?? null,
    created_at: createdAt,
    createdAt,
    updated_at: updatedAt,
    updatedAt,
  };
};

export const fetchRemoteCallRecords = async (query = {}) => {
  const params = {};
  if (query.fromDate) params.from = query.fromDate;
  if (query.toDate) params.to = query.toDate;
  if (query.page) params.page = query.page;
  if (query.limit) params.limit = query.limit;
  if (query.direction) params.direction = query.direction;
  if (query.callId) params.call_id = query.callId;
  if (query.callerId) params.caller_id = query.callerId;
  if (query.agent) params.agent = query.agent;
  const data = await smartfloGet('/call/records', params, 'listCallRecords');
  return asArray(data).map(normalizeCallRecord);
};

export const listLocalCalls = async (query = {}) => {
  const { page, limit, skip, offset } = getPagination(query);
  const filter = buildCallsFilter(query);
  const [rows, total] = await Promise.all([
    DialerCall.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    DialerCall.countDocuments(filter),
  ]);
  return {
    rows: rows.map(serializeCallRecord),
    meta: { ...paginationMeta({ page, limit, total }), offset },
  };
};

export const getLocalCall = async (id) => {
  const filter = [{ smartflo_call_id: id }, { smartflo_uuid: id }];
  if (/^[a-f0-9]{24}$/i.test(id)) filter.push({ _id: id });
  const row = await DialerCall.findOne({ $or: filter }).lean();
  return row ? serializeCallRecord(row) : null;
};

export const listCallbacks = async () => {
  const rows = await Opportunity.find({
    $or: [
      { smartflo_dial_status: 'CALLBACK' },
      { callback_at: { $ne: null } },
    ],
  }).select('opportunity_id lead_id customer_id smartflo_dial_status callback_at callback_note callback_agent_id smartflo_disposition').lean();
  return rows;
};
