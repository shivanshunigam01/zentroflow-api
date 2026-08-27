import { env } from '../../config/env.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import DialerCall from '../../models/DialerCall.js';
import Opportunity from '../../models/Opportunity.js';
import LeadActivity from '../../models/LeadActivity.js';
import { smartfloGet, smartfloPost } from './smartflo.client.js';
import { asArray, firstString } from './smartflo.helpers.js';
import { mapSmartfloStatus } from './smartflo.status.mapper.js';
import { findOpportunityByDialerId } from './smartflo.leads.service.js';
import { writeDialerAudit } from './smartflo.audit.service.js';

const listId = () => env.SMARTFLO_DISPOSITION_LIST_ID?.trim() || null;

const PRIORITY_MAP = {
  LOW: 'P5',
  MEDIUM: 'P3',
  HIGH: 'P2',
  URGENT: 'P1',
};

const normalizeDisposition = (row) => ({
  id: String(firstString(row.id, row.disposition_id, row.status_id, row.value) || ''),
  name: String(firstString(row.name, row.disposition, row.status, row.label) || ''),
  listId: firstString(row.list_id, row.disposition_list_id, listId()),
});

export const fetchDispositions = async () => {
  const id = listId();
  const params = id ? { id, disposition_list_id: id } : undefined;
  const data = await smartfloGet('/dialer/disposition_list', params, 'listDispositions');
  const lists = asArray(data);
  const fromList = lists.flatMap((item) => {
    const statuses = asArray(item.statuses || item.dispositions || item.disposition_statuses || item);
    if (item.name && !item.statuses && !item.dispositions && (item.id || item.disposition_id)) {
      return [normalizeDisposition(item)];
    }
    return statuses.map(normalizeDisposition);
  }).filter((d) => d.id && d.name);
  if (fromList.length) return fromList;
  return lists.map(normalizeDisposition).filter((d) => d.id && d.name);
};

export const storeDisposition = async ({
  leadId,
  callId,
  dispositionStatus,
  subDispositionStatus,
  note,
  notes,
  priority,
  feedback,
  callbackAt,
  changedBy = 'Agent',
}) => {
  if (!dispositionStatus) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'dispositionStatus is required');
  }

  const dispositionNote = notes || note || undefined;

  const call = callId
    ? await DialerCall.findOne({
      $or: [
        ...(callId.match(/^[a-f0-9]{24}$/i) ? [{ _id: callId }] : []),
        { smartflo_call_id: callId },
        { smartflo_uuid: callId },
      ],
    })
    : leadId
      ? await DialerCall.findOne({
        $or: [{ opportunity_id: leadId }, { lead_id: leadId }],
      }).sort({ created_at: -1 })
      : null;

  const uniqueId = firstString(call?.smartflo_uuid, call?.smartflo_call_id, callId);
  if (!uniqueId) {
    throw new ApiError(400, 'INVALID_CALL', 'Call unique_id is required to store a Smartflo disposition');
  }

  const payload = {
    disposition_status: dispositionStatus,
    unique_id: uniqueId,
  };
  if (subDispositionStatus) payload.sub_disposition_status = subDispositionStatus;
  if (dispositionNote) payload.disposition_note = dispositionNote;

  await smartfloPost('/dialer/store-disposition', payload, 'storeDisposition');

  const mapped = mapSmartfloStatus(dispositionStatus);
  const dialStatus = mapped.mapped || 'COMPLETED';

  if (call) {
    call.disposition = mapped.mapped || dispositionStatus;
    call.disposition_code = dispositionStatus;
    call.sub_disposition = subDispositionStatus || call.sub_disposition;
    call.disposition_note = dispositionNote || call.disposition_note;
    call.status = dialStatus === 'CALLBACK' ? 'CALLBACK' : (dialStatus || 'COMPLETED');
    await call.save();
  }

  const opportunity = leadId
    ? await findOpportunityByDialerId(leadId)
    : call?.opportunity_id
      ? await Opportunity.findOne({ opportunity_id: call.opportunity_id })
      : null;

  if (opportunity) {
    opportunity.smartflo_disposition = mapped.mapped || opportunity.smartflo_disposition;
    opportunity.smartflo_sub_disposition = subDispositionStatus || opportunity.smartflo_sub_disposition;
    opportunity.smartflo_external_disposition = mapped.external;
    opportunity.smartflo_dial_status = dialStatus;

    if (feedback) opportunity.dialer_feedback = String(feedback).slice(0, 500);
    if (dispositionNote) opportunity.dialer_notes = String(dispositionNote).slice(0, 2000);
    if (priority) {
      const key = String(priority).toUpperCase();
      opportunity.dialer_priority = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(key) ? key : opportunity.dialer_priority;
      if (PRIORITY_MAP[key]) opportunity.priority = PRIORITY_MAP[key];
    }

    if (dialStatus === 'CALLBACK' || callbackAt) {
      opportunity.callback_at = callbackAt ? new Date(callbackAt) : (opportunity.callback_at || new Date());
      opportunity.callback_note = dispositionNote || opportunity.callback_note;
      opportunity.callback_agent_id = changedBy;
    }

    await opportunity.save();
    await LeadActivity.create({
      opportunity_id: opportunity.opportunity_id,
      customer_id: opportunity.customer_id,
      type: 'call.disposition',
      title: 'Dialer disposition',
      description: mapped.mapped || dispositionStatus,
      changed_by: changedBy,
      payload: {
        dispositionStatus,
        uniqueId,
        priority: priority || null,
        feedback: feedback || null,
        callbackAt: callbackAt || null,
      },
    });
  }

  await writeDialerAudit({
    actor: changedBy,
    action: 'disposition.saved',
    entity: 'call',
    entityId: uniqueId,
    metadata: {
      disposition: mapped.mapped || dispositionStatus,
      opportunityId: opportunity?.opportunity_id || null,
    },
  });

  console.log(JSON.stringify({
    service: 'smartflo',
    operation: 'dialer.disposition',
    status: 'success',
    leadId: opportunity?.opportunity_id || null,
  }));

  return {
    uniqueId,
    disposition: mapped.mapped || dispositionStatus,
    known: mapped.known,
    callId: call?._id?.toString?.() || callId || null,
    opportunityId: opportunity?.opportunity_id || null,
  };
};
