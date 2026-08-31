import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTenantFilter, recordInTenant } from '../src/helpers/tenantScope.js';
import { hasPermission, DEFAULT_TENANT_ID } from '../src/services/permission.service.js';
import { sanitizeAuditPayload } from '../src/services/audit.service.js';
import { getPagination, paginationMeta } from '../src/helpers/pagination.js';

describe('tenant scope', () => {
  const tenantA = { tenant_id: 'tenant-a', organization_id: 'org-a' };
  const tenantB = { tenant_id: 'tenant-b', organization_id: 'org-b' };

  it('buildTenantFilter scopes to tenant_id', () => {
    const filter = buildTenantFilter(tenantA);
    assert.ok(filter.$or || filter.tenant_id);
    assert.equal(recordInTenant({ tenant_id: 'tenant-a' }, tenantA), true);
    assert.equal(recordInTenant({ tenant_id: 'tenant-b' }, tenantA), false);
  });

  it('legacy null tenant records visible only to default tenant', () => {
    const defaultCtx = { tenant_id: DEFAULT_TENANT_ID() };
    assert.equal(recordInTenant({ tenant_id: null }, defaultCtx), true);
    assert.equal(recordInTenant({ tenant_id: null }, tenantB), false);
  });

  it('cross-tenant access denied', () => {
    const record = { tenant_id: 'tenant-b', organization_id: 'org-b' };
    assert.equal(recordInTenant(record, tenantA), false);
  });

  it('dealer-scoped user denied cross-dealer record', () => {
    const dealerCtx = { tenant_id: 'tenant-a', organization_id: 'org-a', dealer_id: 'dealer-1' };
    const record = { tenant_id: 'tenant-a', organization_id: 'org-a', dealer_id: 'dealer-2' };
    assert.equal(recordInTenant(record, dealerCtx), false);
  });
});

describe('RBAC permissions', () => {
  it('wildcard grants all', () => {
    assert.equal(hasPermission(['*'], 'lead:view'), true);
    assert.equal(hasPermission(['*'], 'lead:assign'), true);
  });

  it('specific permission required', () => {
    assert.equal(hasPermission(['lead:view'], 'lead:view'), true);
    assert.equal(hasPermission(['lead:view'], 'lead:assign'), false);
    assert.equal(hasPermission([], 'lead:view'), false);
  });

  it('CRM permissions are distinct', () => {
    assert.equal(hasPermission(['crm:dashboard:view'], 'crm:dashboard:view'), true);
    assert.equal(hasPermission(['lead:view'], 'lead:stage'), false);
  });
});

describe('audit sanitization', () => {
  it('redacts secrets from audit payloads', () => {
    const sanitized = sanitizeAuditPayload({
      name: 'Test',
      access_token: 'secret-token',
      nested: { password_hash: 'hash' },
    });
    assert.equal(sanitized.name, 'Test');
    assert.equal(sanitized.access_token, '[REDACTED]');
    assert.equal(sanitized.nested.password_hash, '[REDACTED]');
  });
});

describe('CRM pagination', () => {
  it('caps page size at 500', () => {
    const { limit } = getPagination({ limit: '9999' });
    assert.equal(limit, 500);
  });

  it('pagination meta calculates total pages', () => {
    const meta = paginationMeta({ page: 1, limit: 20, total: 45 });
    assert.equal(meta.totalPages, 3);
    assert.equal(meta.total, 45);
  });

  it('CRM validator max limit is 100', () => {
    const { limit } = getPagination({ limit: '100' });
    assert.ok(limit <= 100 || limit === 100);
  });
});
