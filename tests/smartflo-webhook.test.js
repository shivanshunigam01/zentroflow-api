import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventKey, parseWebhookEvent } from '../src/services/smartflo/smartflo.webhook.service.js';

describe('duplicate webhook identity', () => {
  it('same call + event + disposition produce one key', () => {
    const payload = {
      event_type: 'Call hangup (Missed or Answered)',
      call_id: 'CALL-99',
      uuid: 'uuid-99',
      disposition: 'Not Interested',
    };
    const first = buildEventKey(parseWebhookEvent(payload));
    const second = buildEventKey(parseWebhookEvent({ data: payload }));
    assert.equal(first, second);
  });
});
