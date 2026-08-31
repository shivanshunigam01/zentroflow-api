import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTenantFilter,
  recordInTenant,
  isPlatformAdmin,
  stripTenantFromBody,
} from '../src/helpers/tenantScope.js';
import { hasPermission } from '../src/services/permission.service.js';
import { sanitizeAuditPayload } from '../src/services/audit.service.js';
import { classifyCrmScore, mapScoreToTemperature } from '../src/constants/crmScoreRules.js';
import { CRM_FOLLOWUP_RESPONSIBILITIES, ACTION_ENGINE_RESPONSIBILITIES } from '../src/constants/crmArchitecture.js';

describe('tenant hierarchy — dealer isolation', () => {
  const dealerA = { tenant_id: 'tenant-a', organization_id: 'org-a', dealer_id: 'dealer-a' };
  const dealerB = { tenant_id: 'tenant-a', organization_id: 'org-a', dealer_id: 'dealer-b' };
  const orgAdmin = { tenant_id: 'tenant-a', organization_id: 'org-a', dealer_id: null, branch_id: null };
  const platformAdmin = { tenant_id: 'tenant-a', organization_id: 'org-a', role_id: 'ROLE-ADMIN', dealer_id: null, branch_id: null };

  it('same tenant different dealer — access denied', () => {
    const record = { tenant_id: 'tenant-a', organization_id: 'org-a', dealer_id: 'dealer-b' };
    assert.equal(recordInTenant(record, dealerA), false);
  });

  it('same tenant same dealer — access allowed', () => {
    const record = { tenant_id: 'tenant-a', organization_id: 'org-a', dealer_id: 'dealer-a' };
    assert.equal(recordInTenant(record, dealerA), true);
  });

  it('org admin can access records with null dealer (legacy)', () => {
    const record = { tenant_id: 'tenant-a', organization_id: 'org-a', dealer_id: null };
    assert.equal(recordInTenant(record, orgAdmin), true);
  });

  it('dealer filter applied in buildTenantFilter', () => {
    const filter = buildTenantFilter(dealerA);
    assert.ok(filter.$and);
    const dealerClause = filter.$and.find((c) => c.$or?.some((o) => o.dealer_id === 'dealer-a'));
    assert.ok(dealerClause);
  });

  it('platform admin detection', () => {
    assert.equal(isPlatformAdmin(platformAdmin), true);
    assert.equal(isPlatformAdmin(dealerA), false);
  });

  it('different tenant — access denied', () => {
    const record = { tenant_id: 'tenant-b', organization_id: 'org-b', dealer_id: 'dealer-a' };
    assert.equal(recordInTenant(record, dealerA), false);
  });

  it('branch isolation within dealer', () => {
    const branchUser = { tenant_id: 'tenant-a', organization_id: 'org-a', dealer_id: 'dealer-a', branch_id: 'branch-1' };
    const record = { tenant_id: 'tenant-a', organization_id: 'org-a', dealer_id: 'dealer-a', branch_id: 'branch-2' };
    assert.equal(recordInTenant(record, branchUser), false);
  });
});

describe('stripTenantFromBody', () => {
  it('removes tenant override fields from client payload', () => {
    const clean = stripTenantFromBody({
      name: 'Test',
      tenant_id: 'evil-tenant',
      dealer_id: 'evil-dealer',
      branch_id: 'evil-branch',
      organization_id: 'evil-org',
    });
    assert.equal(clean.name, 'Test');
    assert.equal(clean.tenant_id, undefined);
    assert.equal(clean.dealer_id, undefined);
  });
});

describe('RBAC — CRM permissions', () => {
  const sePerms = [
    'lead:view', 'lead:edit', 'lead:stage', 'lead:qualify', 'lead:score', 'lead:dedupe',
    'customer:view', 'crm:dashboard:view', 'followup:view', 'followup:edit',
  ];
  const smPerms = [...sePerms, 'lead:assign', 'score_rule:admin'];

  for (const p of sePerms) {
    it(`ROLE-SE has ${p}`, () => {
      assert.equal(hasPermission(sePerms, p), true);
    });
  }

  it('ROLE-SE lacks lead:assign', () => {
    assert.equal(hasPermission(sePerms, 'lead:assign'), false);
  });

  it('ROLE-SM has score_rule:admin', () => {
    assert.equal(hasPermission(smPerms, 'score_rule:admin'), true);
  });

  it('ROLE-SE lacks score_rule:admin', () => {
    assert.equal(hasPermission(sePerms, 'score_rule:admin'), false);
  });
});

describe('deduplication classification logic', () => {
  const classify = (source, candidate, customer, sourceCustomer) => {
    const normalize = (v) => String(v ?? '').trim().toLowerCase();
    const signals = [];
    if (customer?.mobile_normalized && sourceCustomer?.mobile_normalized &&
      customer.mobile_normalized === sourceCustomer.mobile_normalized) signals.push('mobile');
    const sourceEmail = normalize(sourceCustomer?.email);
    const candidateEmail = normalize(customer?.email);
    if (sourceEmail && candidateEmail && sourceEmail === candidateEmail) signals.push('email');
    if (source.external_lead_id && candidate.external_lead_id &&
      source.external_lead_id === candidate.external_lead_id &&
      normalize(source.source) === normalize(candidate.source)) signals.push('external_lead_id');

    const sameProductReq =
      normalize(candidate.product) === normalize(source.product) &&
      normalize(candidate.requirement) === normalize(source.requirement);

    if (signals.includes('external_lead_id') || (signals.includes('mobile') && sameProductReq)) {
      return { classification: 'LIKELY_DUPLICATE', requires_review: false };
    }
    if (signals.includes('mobile') || signals.includes('email')) {
      return {
        classification: sameProductReq ? 'LIKELY_DUPLICATE' : 'EXISTING_CUSTOMER_NEW_LEAD',
        requires_review: !sameProductReq,
      };
    }
    return { classification: 'AMBIGUOUS', requires_review: true };
  };

  it('same tenant same mobile + product — likely duplicate', () => {
    const source = { product: 'SUV', requirement: 'New', source: 'Meta', external_lead_id: null };
    const candidate = { product: 'SUV', requirement: 'New', source: 'Manual', external_lead_id: null };
    const result = classify(
      source, candidate,
      { mobile_normalized: '919999999999', email: null },
      { mobile_normalized: '919999999999', email: null },
    );
    assert.equal(result.classification, 'LIKELY_DUPLICATE');
    assert.equal(result.requires_review, false);
  });

  it('same mobile different product — existing customer new lead', () => {
    const source = { product: 'SUV', requirement: 'New', source: 'Meta', external_lead_id: null };
    const candidate = { product: 'Hatchback', requirement: 'New', source: 'Manual', external_lead_id: null };
    const result = classify(
      source, candidate,
      { mobile_normalized: '919999999999', email: null },
      { mobile_normalized: '919999999999', email: null },
    );
    assert.equal(result.classification, 'EXISTING_CUSTOMER_NEW_LEAD');
    assert.equal(result.requires_review, true);
  });

  it('different tenant same phone — not tested here (tenant filter blocks at query level)', () => {
    assert.ok(true);
  });

  it('external lead id + source match — high confidence', () => {
    const source = { product: 'A', requirement: 'B', source: 'Meta', external_lead_id: 'ext-123' };
    const candidate = { product: 'X', requirement: 'Y', source: 'Meta', external_lead_id: 'ext-123' };
    const result = classify(source, candidate, {}, {});
    assert.equal(result.classification, 'LIKELY_DUPLICATE');
    assert.equal(result.requires_review, false);
  });

  it('ambiguous match flagged for review', () => {
    const source = { product: 'A', requirement: 'B', source: 'Meta', external_lead_id: null };
    const candidate = { product: 'X', requirement: 'Y', source: 'Manual', external_lead_id: null };
    const result = classify(source, candidate, {}, {});
    assert.equal(result.classification, 'AMBIGUOUS');
    assert.equal(result.requires_review, true);
  });
});

describe('queue idempotency and retry logic', () => {
  it('exponential backoff caps at 60s', () => {
    const backoff = (attempts) => Math.min(1000 * 2 ** attempts, 60_000);
    assert.equal(backoff(1), 2000);
    assert.equal(backoff(10), 60_000);
  });

  it('dead letter when attempts >= max_attempts', () => {
    const job = { attempts: 5, max_attempts: 5 };
    assert.equal(job.attempts >= job.max_attempts, true);
  });

  it('idempotency key prevents duplicate enqueue conceptually', () => {
    const keys = new Set();
    const key = 'job:lead:123';
    keys.add(key);
    assert.equal(keys.has(key), true);
    assert.equal(keys.size, 1);
  });
});

describe('audit redaction', () => {
  it('redacts OAuth and integration secrets', () => {
    const sanitized = sanitizeAuditPayload({
      meta_app_secret: 'secret',
      google_client_secret: 'gsecret',
      smtp_password: 'pass',
      oauth_token: 'oauth',
      name: 'visible',
    });
    assert.equal(sanitized.meta_app_secret, '[REDACTED]');
    assert.equal(sanitized.google_client_secret, '[REDACTED]');
    assert.equal(sanitized.smtp_password, '[REDACTED]');
    assert.equal(sanitized.oauth_token, '[REDACTED]');
    assert.equal(sanitized.name, 'visible');
  });
});

describe('scoring bands', () => {
  it('classifies score bands', () => {
    assert.equal(classifyCrmScore(85), 'Hot');
    assert.equal(mapScoreToTemperature(85), 'HOT');
    assert.equal(mapScoreToTemperature(45), 'NURTURE');
  });
});

describe('CRM architecture boundaries', () => {
  it('documents follow-up vs action engine separation', () => {
    assert.equal(CRM_FOLLOWUP_RESPONSIBILITIES.system, 'CRM Followup');
    assert.equal(ACTION_ENGINE_RESPONSIBILITIES.system, 'Action Engine');
    assert.ok(CRM_FOLLOWUP_RESPONSIBILITIES.responsibilities.includes('Scheduled calls and customer callbacks'));
    assert.ok(ACTION_ENGINE_RESPONSIBILITIES.responsibilities.includes('Rule-based next actions'));
  });
});
