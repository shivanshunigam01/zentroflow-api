import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClickToCallPayload,
  mapClickToCallError,
  normalizePhoneForSmartfloCall,
  validateClickToCallPhone,
} from '../src/services/smartflo.service.js';
import { mapCallEventType } from '../src/services/smartflo/smartflo.status.mapper.js';
import { parseWebhookEvent } from '../src/services/smartflo/smartflo.webhook.service.js';

describe('click-to-call support payload', () => {
  it('builds documented body without ivrId', () => {
    const payload = buildClickToCallPayload('918401953392', { opportunityId: 'OP-123', source: 'zentroflow_ivr' });
    assert.equal(payload.customer_number, '918401953392');
    assert.equal(payload.async, 1);
    assert.ok(payload.api_key === undefined || typeof payload.api_key === 'string');
    assert.equal(payload.ivrId, undefined);
    assert.equal(payload.ivr_id, undefined);
    if (payload.custom_identifier) {
      assert.equal(typeof payload.custom_identifier, 'object');
      assert.notEqual(typeof payload.custom_identifier, 'string');
    }
  });

  it('normalizes Indian mobiles to 91XXXXXXXXXX', () => {
    assert.equal(normalizePhoneForSmartfloCall('8401953392'), '918401953392');
    assert.equal(normalizePhoneForSmartfloCall('+91 84019 53392'), '918401953392');
    assert.equal(validateClickToCallPhone('8401953392'), '918401953392');
  });

  it('rejects invalid numbers with SMARTFLO_INVALID_NUMBER', () => {
    assert.throws(() => validateClickToCallPhone('123'), (err) => err.code === 'SMARTFLO_INVALID_NUMBER');
  });
});

describe('click-to-call error mapping', () => {
  it('maps caller id errors', () => {
    const mapped = mapClickToCallError({
      response: { status: 400, data: { success: false, message: 'Provide a valid caller_id.' } },
    });
    assert.equal(mapped.code, 'SMARTFLO_INVALID_CALLER_ID');
    assert.match(mapped.smartfloMessage, /caller_id/i);
  });

  it('maps invalid number field errors', () => {
    const mapped = mapClickToCallError({
      response: {
        status: 400,
        data: { customer_number: ['The customer number must be between 10 and 12 digits.'] },
      },
    });
    assert.equal(mapped.code, 'SMARTFLO_INVALID_NUMBER');
  });

  it('maps unable to process without dropping Smartflo message', () => {
    const mapped = mapClickToCallError({
      response: { status: 400, data: { success: false, message: 'Unable to process this request' } },
    });
    assert.equal(mapped.code, 'SMARTFLO_CALL_FAILED');
    assert.equal(mapped.smartfloMessage, 'Unable to process this request');
    assert.equal(mapped.message, 'Unable to process this request');
  });

  it('maps timeouts', () => {
    const mapped = mapClickToCallError({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' });
    assert.equal(mapped.code, 'SMARTFLO_TIMEOUT');
  });
});

describe('click-to-call webhook events', () => {
  it('maps customer answered / missed / completed / failed', () => {
    assert.equal(mapCallEventType('Customer Answered'), 'CONTACTED');
    assert.equal(mapCallEventType('Customer Missed'), 'NO_ANSWER');
    assert.equal(mapCallEventType('Call Connected'), 'IN_CALL');
    assert.equal(mapCallEventType('Call Completed'), 'COMPLETED');
    assert.equal(mapCallEventType('Call Failed'), 'FAILED');
  });

  it('parses ref_id for correlation', () => {
    const parsed = parseWebhookEvent({
      event: 'Customer Answered',
      ref_id: '504-ref-abc',
      customer_number: '918401953392',
      custom_identifier: { opportunity_id: 'OP123' },
    });
    assert.equal(parsed.refId, '504-ref-abc');
    assert.equal(parsed.uuid, '504-ref-abc');
    assert.equal(parsed.opportunityRef, 'OP123');
  });
});
