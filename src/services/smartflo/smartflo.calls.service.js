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
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.leadId) {
    filter.$or = [{ opportunity_id: query.leadId }, { lead_id: query.leadId }];
  }
  if (query.status) filter.status = query.status;
  if (query.direction) filter.direction = query.direction;
  if (query.callId) {
    filter.$or = [
      ...(filter.$or || []),
      { smartflo_call_id: query.callId },
      { smartflo_uuid: query.callId },
    ];
  }
  const [rows, total] = await Promise.all([
    DialerCall.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    DialerCall.countDocuments(filter),
  ]);
  return { rows, meta: paginationMeta({ page, limit, total }) };
};

export const getLocalCall = async (id) => {
  const filter = [{ smartflo_call_id: id }, { smartflo_uuid: id }];
  if (/^[a-f0-9]{24}$/i.test(id)) filter.push({ _id: id });
  return DialerCall.findOne({ $or: filter }).lean();
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
