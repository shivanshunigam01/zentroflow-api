import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCallsFilter,
  serializeCallRecord,
} from '../src/services/smartflo/smartflo.calls.service.js';

describe('dialer calls list', () => {
  it('builds filter for campaign, agent, status, disposition, and search', () => {
    const filter = buildCallsFilter({
      campaignId: '123',
      agentId: 'agent-9',
      status: 'COMPLETED',
      disposition: 'INTERESTED',
      search: '98765',
    });
    assert.equal(filter.campaign_id, '123');
    assert.equal(filter.agent_id, 'agent-9');
    assert.equal(filter.status, 'COMPLETED');
    assert.equal(filter.disposition, 'INTERESTED');
    assert.ok(Array.isArray(filter.$and));
    assert.equal(filter.$and.length, 1);
    assert.ok(filter.$and[0].$or);
  });

  it('builds date range on created_at by default', () => {
    const filter = buildCallsFilter({
      fromDate: '2026-01-01T00:00:00.000Z',
      toDate: '2026-01-31T23:59:59.999Z',
    });
    assert.ok(filter.created_at.$gte instanceof Date);
    assert.ok(filter.created_at.$lte instanceof Date);
  });

  it('serializes stored Mongo call into dashboard DTO', () => {
    const dto = serializeCallRecord({
      _id: '665f1a2b3c4d5e6f7a8b9c0d',
      smartflo_call_id: 'CALL-1',
      smartflo_lead_id: 'LEAD-1',
      campaign_id: '99',
      lead_id: 'OPP-1',
      agent_id: 'agent-1',
      customer_number: '919999999999',
      caller_id: '918069400000',
      status: 'COMPLETED',
      disposition: 'INTERESTED',
      duration: 42,
      start_time: new Date('2026-07-01T10:00:00.000Z'),
      end_time: new Date('2026-07-01T10:00:42.000Z'),
      created_at: new Date('2026-07-01T10:00:00.000Z'),
      updated_at: new Date('2026-07-01T10:01:00.000Z'),
      recording_ref: 'https://example.com/rec.mp3',
    });
    assert.equal(dto.smartfloCallId, 'CALL-1');
    assert.equal(dto.customerPhone, '919999999999');
    assert.equal(dto.campaignId, '99');
    assert.equal(dto.recordingUrl, 'https://example.com/rec.mp3');
    assert.equal(dto.duration, 42);
  });
});
