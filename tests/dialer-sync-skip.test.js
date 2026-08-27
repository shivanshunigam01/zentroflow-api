import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAlreadySynced,
  mapZentroflowToSmartfloLead,
} from '../src/services/smartflo/smartflo.leads.service.js';

describe('Smartflo lead sync skip / mapping', () => {
  it('skips when status is SYNCED and smartflo_lead_id is set', () => {
    assert.equal(
      isAlreadySynced({ smartflo_sync_status: 'SYNCED', smartflo_lead_id: 'SF-1' }),
      true,
    );
  });

  it('does not skip SYNCED without remote id', () => {
    assert.equal(
      isAlreadySynced({ smartflo_sync_status: 'SYNCED', smartflo_lead_id: null }),
      false,
    );
  });

  it('does not skip FAILED or PENDING', () => {
    assert.equal(isAlreadySynced({ smartflo_sync_status: 'FAILED', smartflo_lead_id: 'x' }), false);
    assert.equal(isAlreadySynced({ smartflo_sync_status: 'PENDING' }), false);
  });

  it('maps field_5 to opportunity_id for webhook match', () => {
    const row = mapZentroflowToSmartfloLead(
      { opportunity_id: 'OPP-55', branch: 'Pune' },
      { name: 'Asha', mobile: '9876543210', email: 'a@x.com' },
    );
    assert.equal(row.field_5, 'OPP-55');
    assert.equal(row.field_0, '9876543210');
    assert.equal(row.field_1, 'Asha');
    assert.equal(row.field_2, 'a@x.com');
    assert.ok(!('field_3' in row) || row.field_3 === undefined || row.field_3 === '');
  });
});
