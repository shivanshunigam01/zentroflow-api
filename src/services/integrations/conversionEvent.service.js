import { randomUUID } from 'crypto';
import ConversionEvent from '../../models/integrations/ConversionEvent.js';
import ConversionEventMapping from '../../models/integrations/ConversionEventMapping.js';
import { enqueueJob } from '../queue/queue.service.js';
import { attachTenantToDoc } from '../../helpers/tenantScope.js';
import { writeAuditLog } from '../audit.service.js';

const DEFAULT_MAPPINGS = [
  { crm_event_type: 'lead_created', platform: 'meta', platform_event_name: 'Lead' },
  { crm_event_type: 'qualified', platform: 'meta', platform_event_name: 'Lead' },
  { crm_event_type: 'test_drive', platform: 'meta', platform_event_name: 'Schedule' },
  { crm_event_type: 'booking', platform: 'meta', platform_event_name: 'Purchase' },
  { crm_event_type: 'retail', platform: 'meta', platform_event_name: 'Purchase' },
  { crm_event_type: 'lead_created', platform: 'google', platform_event_name: 'Lead' },
  { crm_event_type: 'retail', platform: 'google', platform_event_name: 'Purchase' },
];

export const ensureDefaultConversionMappings = async (tenantId) => {
  for (const seed of DEFAULT_MAPPINGS) {
    await ConversionEventMapping.updateOne(
      { tenant_id: tenantId, platform: seed.platform, crm_event_type: seed.crm_event_type },
      { $setOnInsert: { mapping_id: `CEM-${seed.platform}-${seed.crm_event_type}`, ...seed, tenant_id: tenantId, active: true } },
      { upsert: true },
    );
  }
};

export const enqueueConversionEvent = async ({
  tenantContext,
  opportunity,
  event_type,
  event_value = null,
  currency = 'INR',
  correlation_id,
  platform = 'meta',
}) => {
  await ensureDefaultConversionMappings(tenantContext.tenant_id);
  const mapping = await ConversionEventMapping.findOne({
    tenant_id: tenantContext.tenant_id,
    platform,
    crm_event_type: event_type,
    active: true,
  }).lean();
  if (!mapping) return null;

  const idempotencyKey = `conv:${platform}:${opportunity.opportunity_id}:${event_type}`;
  const existing = await ConversionEvent.findOne({ idempotency_key: idempotencyKey }).lean();
  if (existing) return existing;

  const conversion = await ConversionEvent.create({
    conversion_id: `CONV-${randomUUID().slice(0, 8).toUpperCase()}`,
    opportunity_id: opportunity.opportunity_id,
    lead_id: opportunity.lead_id,
    ...attachTenantToDoc(tenantContext, {}),
    platform,
    event_type,
    event_name: mapping.platform_event_name,
    event_value,
    currency,
    event_time: new Date(),
    idempotency_key: idempotencyKey,
    status: 'QUEUED',
    correlation_id,
  });

  await enqueueJob({
    job_type: 'conversion.send',
    payload: { conversion_id: conversion.conversion_id },
    idempotency_key: `job:${idempotencyKey}`,
    tenant_id: tenantContext.tenant_id,
  });

  await writeAuditLog({
    tenantContext,
    action: 'conversion.queued',
    entity_type: 'conversion_event',
    entity_id: conversion.conversion_id,
    after: { event_type, platform, event_name: mapping.platform_event_name },
    correlation_id,
  });

  return conversion;
};

export const processConversionEvent = async (conversionId) => {
  const conversion = await ConversionEvent.findOne({ conversion_id: conversionId });
  if (!conversion) throw new Error(`Conversion not found: ${conversionId}`);
  if (conversion.status === 'SENT') return { skipped: true };

  conversion.status = 'PROCESSING';
  conversion.attempts += 1;
  await conversion.save();

  const tenantContext = {
    tenant_id: conversion.tenant_id,
    organization_id: conversion.organization_id,
    dealer_id: conversion.dealer_id,
    branch_id: conversion.branch_id,
    user_id: 'system',
  };

  try {
    const { getAdapter } = await import('../../integrations/platformAdapter.js');
    await import('../../integrations/meta/metaAdapter.js');
    await import('../../integrations/google/googleAdapter.js');
    const adapter = getAdapter(conversion.platform);
    const result = await adapter.sendConversion({
      tenantContext,
      event: {
        event_name: conversion.event_name,
        event_time: conversion.event_time,
        event_value: conversion.event_value,
        payload: conversion.payload,
      },
    });

    conversion.status = result.status === 'sent' ? 'SENT' : 'SKIPPED';
    conversion.sent_at = new Date();
    conversion.last_error = result.reason || null;
    await conversion.save();
    return result;
  } catch (err) {
    conversion.status = conversion.attempts >= conversion.max_attempts ? 'DEAD_LETTER' : 'FAILED';
    conversion.last_error = err?.message || String(err);
    conversion.next_retry_at = new Date(Date.now() + Math.min(1000 * 2 ** conversion.attempts, 60000));
    await conversion.save();
    throw err;
  }
};
