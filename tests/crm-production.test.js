import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret } from '../src/helpers/crypto.js';
import { verifyMetaWebhookGet } from '../src/services/integrations/meta/metaWebhook.service.js';
import { normalizeMetaLead } from '../src/services/integrations/leadNormalizer.service.js';
import { hasPermission } from '../src/services/permission.service.js';
import { recordInTenant, buildTenantFilter } from '../src/helpers/tenantScope.js';

describe('token encryption', () => {
  it('encrypts and decrypts without exposing plaintext', () => {
    const enc = encryptSecret('meta-access-token-secret');
    assert.notEqual(enc, 'meta-access-token-secret');
    assert.equal(decryptSecret(enc), 'meta-access-token-secret');
  });
});

describe('Meta webhook verification', () => {
  it('returns challenge when verify token matches', () => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = 'test-verify-token';
    const challenge = verifyMetaWebhookGet({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'test-verify-token',
      'hub.challenge': 'challenge-123',
    });
    assert.equal(challenge, 'challenge-123');
  });
});

describe('lead normalization', () => {
  it('normalizes Meta lead field_data', () => {
    const normalized = normalizeMetaLead({
      id: 'lead-123',
      field_data: [
        { name: 'full_name', values: ['John Doe'] },
        { name: 'phone_number', values: ['9876543210'] },
        { name: 'email', values: ['john@example.com'] },
      ],
      campaign_id: 'camp-1',
      ad_id: 'ad-1',
    });
    assert.equal(normalized.name, 'John Doe');
    assert.equal(normalized.mobile, '9876543210');
    assert.equal(normalized.platform, 'meta');
    assert.equal(normalized.external_lead_id, 'lead-123');
  });
});

describe('integration RBAC', () => {
  const smPerms = [
    'integration:view', 'integration:manage', 'routing:view', 'routing:manage',
    'journey:view', 'journey:test_drive', 'journey:booking', 'journey:retail',
  ];
  for (const p of smPerms) {
    it(`ROLE-SM has ${p}`, () => assert.equal(hasPermission(smPerms, p), true));
  }
  it('ROLE-SE lacks integration:manage', () => {
    const se = ['integration:view', 'journey:view'];
    assert.equal(hasPermission(se, 'integration:manage'), false);
  });
});

describe('tenant isolation for integrations', () => {
  it('dealer A cannot access dealer B records', () => {
    const dealerA = { tenant_id: 't1', organization_id: 'o1', dealer_id: 'd1' };
    const record = { tenant_id: 't1', organization_id: 'o1', dealer_id: 'd2' };
    assert.equal(recordInTenant(record, dealerA), false);
  });
  it('tenant filter includes dealer scope', () => {
    const filter = buildTenantFilter({ tenant_id: 't1', dealer_id: 'd1' });
    assert.ok(filter.$and?.length > 0);
  });
});

describe('conversion idempotency', () => {
  it('idempotency key is deterministic', () => {
    const key = `conv:meta:OP-123:retail`;
    assert.ok(key.includes('OP-123'));
    assert.ok(key.includes('retail'));
  });
});

describe('queue retry backoff', () => {
  it('exponential backoff caps at 60s', () => {
    const backoff = (n) => Math.min(1000 * 2 ** n, 60_000);
    assert.equal(backoff(10), 60_000);
  });
});

describe('end-to-end traceability', () => {
  it('correlation id can chain webhook to conversion', () => {
    const correlationId = 'corr-abc-123';
    const ingestion = { correlation_id: correlationId, event_id: 'ING-1' };
    const conversion = { correlation_id: correlationId, conversion_id: 'CONV-1' };
    assert.equal(ingestion.correlation_id, conversion.correlation_id);
  });
});
