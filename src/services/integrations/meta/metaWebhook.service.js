import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { env } from '../../../config/env.js';
import LeadIngestionEvent from '../../../models/integrations/LeadIngestionEvent.js';
import { enqueueJob } from '../../queue/queue.service.js';
import { ApiError } from '../../../middleware/errorHandler.middleware.js';

export const verifyMetaWebhookGet = (query) => {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || env.META_WEBHOOK_VERIFY_TOKEN;
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }
  throw new ApiError(403, 'WEBHOOK_VERIFY_FAILED', 'Webhook verification failed');
};

export const verifyMetaWebhookSignature = (rawBody, signatureHeader) => {
  if (!env.META_APP_SECRET) return true;
  if (!signatureHeader?.startsWith('sha256=')) {
    throw new ApiError(401, 'INVALID_SIGNATURE', 'Missing Meta webhook signature');
  }
  const expected = createHmac('sha256', env.META_APP_SECRET).update(rawBody).digest('hex');
  const received = signatureHeader.slice(7);
  try {
    const ok = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
    if (!ok) throw new ApiError(401, 'INVALID_SIGNATURE', 'Invalid Meta webhook signature');
  } catch {
    throw new ApiError(401, 'INVALID_SIGNATURE', 'Invalid Meta webhook signature');
  }
  return true;
};

export const processMetaWebhook = async (body, correlationId) => {
  const entries = body?.entry || [];
  const results = [];

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') continue;
      const value = change.value || {};
      const externalLeadId = value.leadgen_id;
      const externalEventId = `${entry.id}:${change.value?.created_time || Date.now()}:${externalLeadId}`;
      const idempotencyKey = `meta:leadgen:${externalLeadId}`;

      let event;
      try {
        event = await LeadIngestionEvent.create({
          event_id: `ING-${randomUUID()}`,
          platform: 'meta',
          event_type: 'leadgen',
          external_event_id: externalEventId,
          external_lead_id: externalLeadId,
          idempotency_key: idempotencyKey,
          meta_form_id: value.form_id || null,
          raw_payload: { entry_id: entry.id, page_id: value.page_id, form_id: value.form_id, ad_id: value.ad_id },
          processing_status: 'RECEIVED',
          correlation_id: correlationId,
        });
      } catch (err) {
        if (err?.code === 11000) {
          const existing = await LeadIngestionEvent.findOne({ idempotency_key: idempotencyKey }).lean();
          results.push({ duplicate: true, event_id: existing?.event_id });
          continue;
        }
        throw err;
      }

      await enqueueJob({
        job_type: 'lead.ingestion.process',
        payload: { event_id: event.event_id },
        idempotency_key: `job:${idempotencyKey}`,
        correlation_id: correlationId,
      });

      await LeadIngestionEvent.updateOne({ event_id: event.event_id }, { processing_status: 'QUEUED' });
      results.push({ event_id: event.event_id, queued: true });
    }
  }

  return { processed: results.length, results };
};
