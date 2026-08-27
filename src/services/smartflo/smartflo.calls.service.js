import DialerCall from '../../models/DialerCall.js';
import Opportunity from '../../models/Opportunity.js';
import { env } from '../../config/env.js';
import { getPagination, paginationMeta } from '../../helpers/pagination.js';
import { enrichLeadDto } from '../../helpers/leadDto.js';
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

const OPEN_CALL_STATUSES = ['RINGING', 'IN_CALL', 'DISPOSITION_PENDING', 'CONNECTED'];

/**
 * Latest open dialer call for the agent UI, with enriched lead when matched.
 * Empty → { call: null, lead: null, state: 'WAITING' }
 */
export const getCurrentCall = async (user = null) => {
  const filter = {
    status: { $in: OPEN_CALL_STATUSES },
  };
  if (env.SMARTFLO_CAMPAIGN_ID?.trim()) {
    filter.$or = [
      { campaign_id: env.SMARTFLO_CAMPAIGN_ID.trim() },
      { campaign_id: null },
      { campaign_id: { $exists: false } },
    ];
  }

  const row = await DialerCall.findOne(filter).sort({ updated_at: -1, created_at: -1 }).lean();
  if (!row) {
    return { call: null, lead: null, campaignId: env.SMARTFLO_CAMPAIGN_ID || null, state: 'WAITING' };
  }

  const call = serializeCallRecord(row);
  let lead = null;
  if (row.opportunity_id || row.lead_id) {
    const opp = await Opportunity.findOne({
      $or: [
        ...(row.opportunity_id ? [{ opportunity_id: row.opportunity_id }] : []),
        ...(row.lead_id ? [{ lead_id: row.lead_id }, { opportunity_id: row.lead_id }] : []),
      ],
    });
    if (opp) lead = await enrichLeadDto(opp);
  }

  const status = String(row.status || '').toUpperCase();
  let state = 'WAITING';
  if (status === 'RINGING') state = 'RINGING';
  else if (status === 'IN_CALL' || status === 'CONNECTED') state = 'CONNECTED';
  else if (status === 'DISPOSITION_PENDING') state = 'DISPOSITION_PENDING';
  else if (['COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CALL_DROPPED'].includes(status)) state = 'ENDED';

  return {
    call,
    lead,
    campaignId: env.SMARTFLO_CAMPAIGN_ID || null,
    agent: user ? { email: user.email || null, name: user.name || null } : null,
    state,
  };
};

/** Aggregate dialer stats from DialerCall + Opportunity sync fields. */
export const getDialerStatistics = async () => {
  const [
    totalLeads,
    synced,
    pending,
    failedSync,
    callAgg,
  ] = await Promise.all([
    Opportunity.countDocuments({}),
    Opportunity.countDocuments({ smartflo_sync_status: 'SYNCED' }),
    Opportunity.countDocuments({
      $or: [
        { smartflo_sync_status: { $in: ['PENDING', null] } },
        { smartflo_sync_status: { $exists: false } },
      ],
    }),
    Opportunity.countDocuments({ smartflo_sync_status: 'FAILED' }),
    DialerCall.aggregate([
      {
        $group: {
          _id: null,
          dialed: { $sum: 1 },
          connected: {
            $sum: {
              $cond: [{ $in: ['$status', ['IN_CALL', 'CONNECTED', 'COMPLETED', 'INTERESTED', 'CONVERTED', 'CONTACTED', 'DISPOSITION_PENDING']] }, 1, 0],
            },
          },
          completed: {
            $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'INTERESTED', 'CONVERTED', 'CONTACTED', 'NOT_INTERESTED', 'CALLBACK']] }, 1, 0] },
          },
          interested: { $sum: { $cond: [{ $eq: ['$disposition', 'INTERESTED'] }, 1, 0] } },
          notInterested: { $sum: { $cond: [{ $eq: ['$disposition', 'NOT_INTERESTED'] }, 1, 0] } },
          callbacks: { $sum: { $cond: [{ $eq: ['$disposition', 'CALLBACK'] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ['$disposition', 'CONVERTED'] }, 1, 0] } },
          noAnswer: { $sum: { $cond: [{ $in: ['$status', ['NO_ANSWER']] }, 1, 0] } },
          busy: { $sum: { $cond: [{ $eq: ['$status', 'BUSY'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $in: ['$status', ['FAILED', 'CALL_DROPPED']] }, 1, 0] } },
          totalDuration: { $sum: { $ifNull: ['$duration', 0] } },
        },
      },
    ]),
  ]);

  const c = callAgg[0] || {};
  const dialed = c.dialed || 0;
  const connected = c.connected || 0;
  const completed = c.completed || 0;
  const interested = c.interested || 0;
  const converted = c.converted || 0;
  const avgDuration = dialed > 0 ? Math.round((c.totalDuration || 0) / dialed) : 0;

  return {
    totalLeads,
    synced,
    pending,
    failedSync,
    dialed,
    connected,
    completed,
    interested,
    notInterested: c.notInterested || 0,
    callbacks: c.callbacks || 0,
    converted,
    noAnswer: c.noAnswer || 0,
    busy: c.busy || 0,
    failed: c.failed || 0,
    connectionRate: dialed > 0 ? Number(((connected / dialed) * 100).toFixed(1)) : 0,
    answerRate: dialed > 0 ? Number(((connected / dialed) * 100).toFixed(1)) : 0,
    conversionRate: connected > 0 ? Number(((converted / connected) * 100).toFixed(1)) : 0,
    interestRate: connected > 0 ? Number(((interested / connected) * 100).toFixed(1)) : 0,
    averageCallDuration: avgDuration,
  };
};
