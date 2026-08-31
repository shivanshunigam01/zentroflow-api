import AuditLog from '../models/crm/AuditLog.js';

const SECRET_KEYS = [
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'api_secret',
  'secret',
  'smtp_pass',
  'smtp_password',
  'meta_app_secret',
  'meta_access_token',
  'google_client_secret',
  'google_ads_refresh_token',
  'oauth_token',
  'authorization',
  'private_key',
  'client_secret',
];

const sanitizeValue = (value, depth = 0) => {
  if (depth > 5 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (SECRET_KEYS.some((s) => lower.includes(s))) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = sanitizeValue(val, depth + 1);
    }
  }
  return out;
};

export const sanitizeAuditPayload = (payload) => sanitizeValue(payload);

export const writeAuditLog = async ({
  tenantContext,
  action,
  entity_type,
  entity_id,
  before = null,
  after = null,
  correlation_id = null,
  ip_address = null,
}) => {
  if (!tenantContext?.tenant_id) return null;
  return AuditLog.create({
    tenant_id: tenantContext.tenant_id,
    organization_id: tenantContext.organization_id ?? null,
    dealer_id: tenantContext.dealer_id ?? null,
    branch_id: tenantContext.branch_id ?? null,
    actor_user_id: tenantContext.user_id || tenantContext.user_email || 'system',
    action,
    entity_type,
    entity_id,
    before: before ? sanitizeAuditPayload(before) : null,
    after: after ? sanitizeAuditPayload(after) : null,
    correlation_id,
    ip_address,
  });
};
