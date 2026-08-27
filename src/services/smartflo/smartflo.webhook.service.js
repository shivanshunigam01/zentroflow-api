import crypto from 'crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { normalizeMobile } from '../../helpers/mobile.js';
import Customer from '../../models/Customer.js';
import Opportunity from '../../models/Opportunity.js';
import DialerCall from '../../models/DialerCall.js';
import LeadActivity from '../../models/LeadActivity.js';
import SmartfloWebhookEvent from '../../models/SmartfloWebhookEvent.js';
import { writeDialerAudit } from './smartflo.audit.service.js';
import { firstString } from './smartflo.helpers.js';
import { mapCallEventType, mapSmartfloStatus } from './smartflo.status.mapper.js';

const pickPayload = (body = {}) => body.data && typeof body.data === 'object' ? { ...body, ...body.data } : body;

/** Map Smartflo disposition / event → Opportunity dial fields (idempotent with event_key). */
const applyOpportunityDialStatus = (opportunity, parsed) => {
  const disp = mapSmartfloStatus(parsed.disposition);
  const eventStatus = mapCallEventType(parsed.eventType);
  opportunity.smartflo_last_call_id = parsed.callId || parsed.uuid || opportunity.smartflo_last_call_id;
  opportunity.smartflo_last_call_at = new Date();

  if (eventStatus === 'RINGING' || eventStatus === 'IN_CALL') {
    opportunity.smartflo_dial_status = eventStatus;
  }
  if (eventStatus === 'DISPOSITION_PENDING' && !disp.mapped) {
    opportunity.smartflo_dial_status = 'DISPOSITION_PENDING';
  }

  if (disp.mapped) {
    opportunity.smartflo_disposition = disp.mapped;
    opportunity.smartflo_dial_status = disp.mapped;
    if (disp.mapped === 'CALLBACK') {
      opportunity.callback_at = opportunity.callback_at || new Date();
    }
    if (disp.mapped === 'INTERESTED' || disp.mapped === 'CONVERTED') {
      // Keep dial status as business outcome; CRM stage changes stay manual / other flows.
    }
  } else if (parsed.disposition) {
    opportunity.smartflo_external_disposition = parsed.disposition;
  }

  if (parsed.subDisposition) opportunity.smartflo_sub_disposition = parsed.subDisposition;
  if (parsed.smartfloLeadId && !opportunity.smartflo_lead_id) {
    opportunity.smartflo_lead_id = parsed.smartfloLeadId;
  }
};

export const parseWebhookEvent = (body = {}) => {
  const src = pickPayload(body);
  const eventType = firstString(
    src.event,
    src.event_type,
    src.eventName,
    src.type,
    src.call_event,
    src.notification_type,
  );
  const callId = firstString(src.call_id, src.callId, src.id);
  const refId = firstString(src.ref_id, src.refId, src.reference_id);
  const uuid = firstString(src.uuid, src.unique_id, src.uniqueId, refId);
  const customerNumber = firstString(
    src.customer_number,
    src.destination,
    src.phone,
    src.phone_number,
    src.field_0,
    src.lead_number,
  );
  const campaignId = firstString(src.campaign_id, src.campaignId, src.campaign);
  const disposition = firstString(
    src.disposition,
    src.disposition_status,
    src.disposition_name,
    src.dialer_disposition,
  );
  const custom = src.custom_identifier && typeof src.custom_identifier === 'object'
    ? src.custom_identifier
    : {};
  const opportunityRef = firstString(
    src.field_5,
    src.lead_ref,
    src.crm_id,
    src.opportunity_id,
    custom.opportunity_id,
  );
  const smartfloLeadId = firstString(src.lead_id, src.smartflo_lead_id, src.broadcast_lead_id);

  return {
    eventType,
    callId,
    uuid,
    refId,
    customerNumber,
    campaignId,
    disposition,
    subDisposition: firstString(src.sub_disposition, src.sub_disposition_status),
    agentId: firstString(src.agent_id, src.agent_number, src.agentId),
    agentName: firstString(src.agent_name, src.agent, src.agentName),
    direction: firstString(src.direction, src.call_direction),
    duration: Number(src.duration || src.billsec || 0) || null,
    startTime: src.start_time || src.started_at || src.call_start || null,
    endTime: src.end_time || src.ended_at || src.hangup_time || null,
    recordingRef: firstString(src.recording, src.recording_url, src.recording_id),
    opportunityRef,
    smartfloLeadId,
    callerId: firstString(src.caller_id, src.did),
    hangupCause: firstString(src.hangup_cause, src.status, src.call_status),
  };
};

export const buildEventKey = (parsed) => {
  const parts = [
    parsed.callId || parsed.uuid || 'unknown',
    parsed.eventType || 'event',
    parsed.disposition || parsed.hangupCause || '',
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
};

export const verifyWebhookSecret = (req) => {
  const expected = env.SMARTFLO_WEBHOOK_SECRET?.trim();
  if (!expected) return;
  const header = firstString(
    req.headers['x-smartflo-secret'],
    req.headers['x-webhook-secret'],
    req.headers['x-hub-signature'],
  );
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (header !== expected && bearer !== expected) {
    throw new ApiError(401, 'WEBHOOK_UNAUTHORIZED', 'Invalid webhook secret');
  }
};

const matchOpportunity = async (parsed) => {
  if (parsed.smartfloLeadId) {
    const byRemote = await Opportunity.findOne({ smartflo_lead_id: String(parsed.smartfloLeadId) });
    if (byRemote) return byRemote;
  }
  if (parsed.opportunityRef) {
    const byOpp = await Opportunity.findOne({
      $or: [{ opportunity_id: parsed.opportunityRef }, { lead_id: parsed.opportunityRef }],
    });
    if (byOpp) return byOpp;
  }
  const digits = normalizeMobile(parsed.customerNumber || '');
  if (digits) {
    const customer = await Customer.findOne({ mobile_normalized: digits });
    if (customer) {
      return Opportunity.findOne({ customer_id: customer.customer_id }).sort({ updated_at: -1 });
    }
  }
  return null;
};

const upsertCall = async (parsed, opportunity) => {
  const orFilters = [];
  if (parsed.callId) orFilters.push({ smartflo_call_id: parsed.callId });
  if (parsed.uuid) {
    orFilters.push({ smartflo_uuid: parsed.uuid });
    orFilters.push({ smartflo_ref_id: parsed.uuid });
  }
  if (parsed.refId) {
    orFilters.push({ smartflo_ref_id: parsed.refId });
    orFilters.push({ smartflo_uuid: parsed.refId });
  }
  if (orFilters.length === 0) return null;

  const existing = await DialerCall.findOne({ $or: orFilters });
  const filter = existing
    ? { _id: existing._id }
    : (parsed.callId
      ? { smartflo_call_id: parsed.callId }
      : { smartflo_ref_id: parsed.refId || parsed.uuid });

  const eventStatus = mapCallEventType(parsed.eventType);
  const hangup = mapSmartfloStatus(parsed.hangupCause);
  const disp = mapSmartfloStatus(parsed.disposition);
  const status = disp.mapped || eventStatus || hangup.mapped || parsed.hangupCause;

  const patch = {
    opportunity_id: opportunity?.opportunity_id || undefined,
    lead_id: opportunity?.lead_id || undefined,
    customer_id: opportunity?.customer_id || undefined,
    customer_number: parsed.customerNumber || undefined,
    smartflo_call_id: parsed.callId || undefined,
    smartflo_uuid: parsed.uuid || parsed.refId || undefined,
    smartflo_ref_id: parsed.refId || parsed.uuid || undefined,
    smartflo_lead_id: parsed.smartfloLeadId || opportunity?.smartflo_lead_id || undefined,
    campaign_id: parsed.campaignId || env.SMARTFLO_CAMPAIGN_ID || undefined,
    agent_id: parsed.agentId || undefined,
    agent_name: parsed.agentName || undefined,
    caller_id: parsed.callerId || undefined,
    direction: parsed.direction || 'outbound',
    status,
    disposition: disp.mapped || parsed.disposition || undefined,
    disposition_code: parsed.disposition || undefined,
    sub_disposition: parsed.subDisposition || undefined,
    duration: parsed.duration,
    recording_ref: parsed.recordingRef || undefined,
    raw_event_ref: parsed.eventType || undefined,
  };
  if (parsed.startTime) patch.start_time = new Date(parsed.startTime);
  if (parsed.endTime) patch.end_time = new Date(parsed.endTime);
  if (
    eventStatus === 'IN_CALL'
    || eventStatus === 'CONTACTED'
    || /connected|answered/i.test(parsed.eventType || '')
  ) {
    patch.answered_at = parsed.startTime ? new Date(parsed.startTime) : new Date();
  }

  const cleaned = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  return DialerCall.findOneAndUpdate(filter, { $set: cleaned }, { upsert: true, new: true });
};

/**
 * Idempotent webhook processor. Returns quickly after persist.
 */
export const processSmartfloWebhook = async (body) => {
  const parsed = parseWebhookEvent(body || {});
  const eventKey = buildEventKey(parsed);

  const existing = await SmartfloWebhookEvent.findOne({ event_key: eventKey });
  if (existing?.processed) {
    return { duplicate: true, eventKey, opportunity_id: existing.opportunity_id };
  }

  const opportunity = await matchOpportunity(parsed);
  const call = await upsertCall(parsed, opportunity);

  if (opportunity) {
    applyOpportunityDialStatus(opportunity, parsed);
    await opportunity.save();

    if (!existing) {
      await LeadActivity.create({
        opportunity_id: opportunity.opportunity_id,
        customer_id: opportunity.customer_id,
        type: 'call.webhook',
        title: parsed.eventType || 'Smartflo call event',
        description: parsed.disposition || parsed.hangupCause || parsed.eventType,
        changed_by: 'Smartflo',
        payload: {
          callId: parsed.callId,
          uuid: parsed.uuid,
          eventType: parsed.eventType,
        },
      });
    }
  }

  await SmartfloWebhookEvent.findOneAndUpdate(
    { event_key: eventKey },
    {
      $set: {
        event_type: parsed.eventType,
        smartflo_call_id: parsed.callId,
        smartflo_uuid: parsed.uuid,
        customer_number: parsed.customerNumber,
        campaign_id: parsed.campaignId,
        disposition: parsed.disposition,
        opportunity_id: opportunity?.opportunity_id || null,
        duplicate: Boolean(existing),
        processed: true,
        processed_at: new Date(),
        payload: {
          eventType: parsed.eventType,
          callId: parsed.callId,
          uuid: parsed.uuid,
          customerNumber: parsed.customerNumber,
          disposition: parsed.disposition,
        },
      },
    },
    { upsert: true, new: true },
  );

  await writeDialerAudit({
    actor: 'Smartflo',
    action: existing ? 'webhook.duplicate' : 'webhook.processed',
    entity: 'call',
    entityId: parsed.callId || parsed.uuid || eventKey,
    metadata: {
      eventType: parsed.eventType || null,
      disposition: parsed.disposition || null,
      opportunityId: opportunity?.opportunity_id || null,
      duplicate: Boolean(existing),
    },
  });

  console.log(JSON.stringify({
    service: 'smartflo',
    operation: 'smartflo.webhook',
    eventType: parsed.eventType,
    callId: parsed.callId || null,
    duplicate: Boolean(existing),
    matched: Boolean(opportunity),
    status: 'success',
  }));

  return {
    duplicate: Boolean(existing),
    eventKey,
    opportunity_id: opportunity?.opportunity_id || null,
    call_id: call?.smartflo_call_id || parsed.callId,
  };
};
