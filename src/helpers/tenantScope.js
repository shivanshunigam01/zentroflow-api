import { DEFAULT_TENANT_ID } from '../services/permission.service.js';

/**
 * Platform/org admin: no dealer or branch restriction within tenant.
 * Dealer user: scoped to dealer_id.
 * Branch user: scoped to branch_id (most restrictive).
 */
export const isPlatformAdmin = (tenantContext) =>
  tenantContext?.role_id === 'ROLE-ADMIN' && !tenantContext?.dealer_id && !tenantContext?.branch_id;

export const isOrgScopedUser = (tenantContext) =>
  !tenantContext?.dealer_id && !tenantContext?.branch_id;

const legacyOrMatch = (field, value) => ({
  $or: [
    { [field]: value },
    { [field]: null },
    { [field]: { $exists: false } },
  ],
});

/**
 * Build MongoDB filter scoped to the authenticated user's tenant context.
 * Never accept tenant_id from request body/query for authorization.
 */
export const buildTenantFilter = (tenantContext, extra = {}) => {
  if (!tenantContext?.tenant_id) {
    return { ...extra, _tenant_blocked: true };
  }

  const isDefault = tenantContext.tenant_id === DEFAULT_TENANT_ID();
  const tenantClause = isDefault
    ? {
        $or: [
          { tenant_id: tenantContext.tenant_id },
          { tenant_id: null },
          { tenant_id: { $exists: false } },
        ],
      }
    : { tenant_id: tenantContext.tenant_id };

  const filter = { ...extra, ...tenantClause };
  const andClauses = [];

  if (tenantContext.organization_id) {
    andClauses.push(legacyOrMatch('organization_id', tenantContext.organization_id));
  }

  if (tenantContext.dealer_id) {
    andClauses.push(legacyOrMatch('dealer_id', tenantContext.dealer_id));
  }

  if (tenantContext.branch_id) {
    andClauses.push(legacyOrMatch('branch_id', tenantContext.branch_id));
  }

  if (andClauses.length) {
    filter.$and = [...(filter.$and || []), ...andClauses];
  }

  return filter;
};

/** Strip tenant keys from client payloads — tenant comes from auth only. */
export const stripTenantFromBody = (body = {}) => {
  const copy = { ...body };
  delete copy.tenant_id;
  delete copy.organization_id;
  delete copy.dealer_id;
  delete copy.branch_id;
  return copy;
};

export const attachTenantToDoc = (tenantContext, doc = {}) => ({
  ...doc,
  tenant_id: tenantContext.tenant_id,
  organization_id: tenantContext.organization_id ?? null,
  dealer_id: tenantContext.dealer_id ?? null,
  branch_id: tenantContext.branch_id ?? null,
});

/**
 * Verify a record belongs to the user's tenant hierarchy.
 * Returns false for cross-tenant, cross-org, cross-dealer, or cross-branch access.
 */
export const recordInTenant = (record, tenantContext) => {
  if (!record || !tenantContext?.tenant_id) return false;

  const recordTenant = record.tenant_id;
  if (!recordTenant) {
    if (tenantContext.tenant_id !== DEFAULT_TENANT_ID()) return false;
  } else if (recordTenant !== tenantContext.tenant_id) {
    return false;
  }

  if (
    tenantContext.organization_id &&
    record.organization_id &&
    record.organization_id !== tenantContext.organization_id
  ) {
    return false;
  }

  if (
    tenantContext.dealer_id &&
    record.dealer_id &&
    record.dealer_id !== tenantContext.dealer_id
  ) {
    return false;
  }

  if (
    tenantContext.branch_id &&
    record.branch_id &&
    record.branch_id !== tenantContext.branch_id
  ) {
    return false;
  }

  return true;
};
