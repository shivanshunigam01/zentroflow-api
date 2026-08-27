import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapZentroflowToSmartfloLead } from '../src/services/smartflo/smartflo.leads.service.js';

describe('dialer sync-all lead mapping', () => {
  it('maps opportunity + customer to Smartflo field_0..field_5', () => {
    const row = mapZentroflowToSmartfloLead(
      { opportunity_id: 'OPP-100', branch: 'Mumbai' },
      { name: 'Rahul', mobile: '+91 98765 43210', email: 'rahul@example.com', address: 'Andheri' },
    );
    assert.equal(row.field_0, '9876543210');
    assert.equal(row.field_1, 'Rahul');
    assert.equal(row.field_2, 'rahul@example.com');
    assert.equal(row.field_3, 'Andheri');
    assert.equal(row.field_4, 'Mumbai');
    assert.equal(row.field_5, 'OPP-100');
  });

  it('rejects invalid Indian mobile numbers', () => {
    assert.throws(
      () => mapZentroflowToSmartfloLead(
        { opportunity_id: 'OPP-101' },
        { name: 'Bad', mobile: '12345' },
      ),
      (err) => err.code === 'INVALID_LEAD',
    );
  });
});
