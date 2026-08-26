import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapCallEventType, mapSmartfloStatus } from '../src/services/smartflo/smartflo.status.mapper.js';
import { mapZentroflowToSmartfloLead } from '../src/services/smartflo/smartflo.leads.service.js';
import { mapSmartfloError, sanitizeForLog } from '../src/services/smartflo/smartflo.errors.js';
import { buildEventKey, parseWebhookEvent } from '../src/services/smartflo/smartflo.webhook.service.js';

describe('smartflo status mapper', () => {
  it('maps known dispositions', () => {
    assert.equal(mapSmartfloStatus('Interested').mapped, 'INTERESTED');
    assert.equal(mapSmartfloStatus('Not Interested').mapped, 'NOT_INTERESTED');
    assert.equal(mapSmartfloStatus('Schedule Call').mapped, 'CALLBACK');
    assert.equal(mapSmartfloStatus('Successful').mapped, 'CONVERTED');
    assert.equal(mapSmartfloStatus('Busy').mapped, 'BUSY');
    assert.equal(mapSmartfloStatus('Answered').mapped, 'CONTACTED');
  });

  it('preserves unknown values as external disposition', () => {
    const result = mapSmartfloStatus('Weird Custom Bucket');
    assert.equal(result.mapped, null);
    assert.equal(result.known, false);
    assert.equal(result.external, 'Weird Custom Bucket');
  });

  it('maps call events', () => {
    assert.equal(mapCallEventType('Call Connected to Agent (Dialer)'), 'IN_CALL');
    assert.equal(mapCallEventType('Call hangup'), 'COMPLETED');
  });
});

describe('lead mapping', () => {
  it('maps ZentroFLOW fields onto Smartflo field_0..field_5', () => {
    const row = mapZentroflowToSmartfloLead(
      { opportunity_id: 'ABC-OP-1', branch: 'Chennai' },
      { name: 'John Doe', mobile: '+91 98765 43210', email: 'john@example.com', address: 'T Nagar' },
    );
    assert.equal(row.field_0, '9876543210');
    assert.equal(row.field_1, 'John Doe');
    assert.equal(row.field_2, 'john@example.com');
    assert.equal(row.field_3, 'T Nagar');
    assert.equal(row.field_4, 'Chennai');
    assert.equal(row.field_5, 'ABC-OP-1');
  });

  it('rejects invalid phones', () => {
    assert.throws(
      () => mapZentroflowToSmartfloLead({ opportunity_id: 'x' }, { name: 'A', mobile: '123' }),
      /invalid/i,
    );
  });
});

describe('smartflo errors', () => {
  it('maps timeout and 429 without leaking tokens', () => {
    const timeout = mapSmartfloError({ code: 'ECONNABORTED', message: 'timeout' }, 'syncLead');
    assert.equal(timeout.code, 'SMARTFLO_TIMEOUT');
    const rate = mapSmartfloError({ response: { status: 429, data: { message: 'slow down' } } }, 'syncLead');
    assert.equal(rate.code, 'SMARTFLO_RATE_LIMITED');
    const sanitized = sanitizeForLog({ Authorization: 'Bearer secret', token: 'abc', ok: true });
    assert.equal(sanitized.Authorization, '[redacted]');
    assert.equal(sanitized.token, '[redacted]');
    assert.equal(sanitized.ok, true);
  });
});

describe('webhook parsing and idempotency key', () => {
  it('extracts call, lead, and disposition from varied payloads', () => {
    const parsed = parseWebhookEvent({
      event: 'Disposition Status Updated (Dialer)',
      call_id: 'c1',
      unique_id: 'u1',
      customer_number: '919876543210',
      disposition: 'Interested',
      field_5: 'ABC-OP-1',
    });
    assert.equal(parsed.callId, 'c1');
    assert.equal(parsed.uuid, 'u1');
    assert.equal(parsed.disposition, 'Interested');
    assert.equal(parsed.opportunityRef, 'ABC-OP-1');
  });

  it('builds a stable key so duplicate events collide', () => {
    const parsed = parseWebhookEvent({ event: 'hangup', call_id: 'c1', disposition: 'Busy' });
    const a = buildEventKey(parsed);
    const b = buildEventKey(parsed);
    assert.equal(a, b);
    const other = buildEventKey(parseWebhookEvent({ event: 'hangup', call_id: 'c2', disposition: 'Busy' }));
    assert.notEqual(a, other);
  });
});
