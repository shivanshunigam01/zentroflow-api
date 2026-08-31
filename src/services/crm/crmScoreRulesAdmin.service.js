import { randomUUID } from 'crypto';
import ScoreRule from '../../models/crm/ScoreRule.js';
import { DEFAULT_SCORE_RULES, SCORE_BANDS } from '../../constants/crmScoreRules.js';
import { stripTenantFromBody } from '../../helpers/tenantScope.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { writeAuditLog } from '../audit.service.js';

const ALLOWED_FIELDS = new Set([
  'purchase_timeline', 'verification_status', 'product', 'qualification_status',
  'temperature', 'lead_score', 'source', 'current_stage', 'customer.mobile', 'customer.email',
]);

const ALLOWED_OPERATORS = new Set(['eq', 'gte', 'lte', 'exists', 'event']);

const ruleFilterForTenant = (tenantContext) => ({
  $or: [
    { tenant_id: tenantContext.tenant_id },
    { tenant_id: null },
    { tenant_id: { $exists: false } },
  ],
});

export const ensureDefaultScoreRules = async () => {
  for (const seed of DEFAULT_SCORE_RULES) {
    await ScoreRule.updateOne(
      { rule_id: seed.rule_id, tenant_id: null },
      { $setOnInsert: { ...seed, tenant_id: null, active: true } },
      { upsert: true },
    );
  }
};

export const listScoreRulesForTenant = async (tenantContext, { includeInactive = false } = {}) => {
  await ensureDefaultScoreRules();
  const filter = ruleFilterForTenant(tenantContext);
  if (!includeInactive) filter.active = true;
  return ScoreRule.find(filter).sort({ priority: 1, created_at: 1 }).lean();
};

export const listScoreRulesAdmin = async (tenantContext) => {
  await ensureDefaultScoreRules();
  return ScoreRule.find(ruleFilterForTenant(tenantContext))
    .sort({ priority: 1, created_at: 1 })
    .lean();
};

export const createScoreRule = async ({
  tenantContext,
  body,
  correlation_id,
  ip_address,
}) => {
  const safe = stripTenantFromBody(body);
  if (!safe.name?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'name is required');
  if (!ALLOWED_OPERATORS.has(safe.operator)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid operator');
  }
  if (safe.field && !ALLOWED_FIELDS.has(safe.field)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid field');
  }

  const rule_id = `SR-${randomUUID().slice(0, 8).toUpperCase()}`;
  const rule = await ScoreRule.create({
    rule_id,
    tenant_id: tenantContext.tenant_id,
    rule_code: safe.rule_code?.trim() || rule_id.toLowerCase(),
    name: safe.name.trim(),
    field: safe.field || null,
    operator: safe.operator || 'event',
    expected_value: safe.expected_value ?? null,
    points: Number(safe.points) || 0,
    version: 1,
    active: safe.active !== false,
    priority: Number(safe.priority) || 100,
  });

  await writeAuditLog({
    tenantContext,
    action: 'score_rule.created',
    entity_type: 'score_rule',
    entity_id: rule.rule_id,
    after: rule.toObject(),
    correlation_id,
    ip_address,
  });

  return rule;
};

export const updateScoreRule = async ({
  tenantContext,
  ruleId,
  body,
  correlation_id,
  ip_address,
}) => {
  const rule = await ScoreRule.findOne({
    rule_id: ruleId,
    ...ruleFilterForTenant(tenantContext),
  });
  if (!rule) throw new ApiError(404, 'SCORE_RULE_NOT_FOUND', 'Score rule not found');

  if (rule.tenant_id === null && tenantContext.role_id !== 'ROLE-ADMIN') {
    throw new ApiError(403, 'FORBIDDEN', 'Cannot modify global default rules');
  }

  const safe = stripTenantFromBody(body);
  const before = rule.toObject();

  if (safe.name !== undefined) rule.name = safe.name.trim();
  if (safe.field !== undefined) {
    if (safe.field && !ALLOWED_FIELDS.has(safe.field)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid field');
    }
    rule.field = safe.field;
  }
  if (safe.operator !== undefined) {
    if (!ALLOWED_OPERATORS.has(safe.operator)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid operator');
    }
    rule.operator = safe.operator;
  }
  if (safe.expected_value !== undefined) rule.expected_value = safe.expected_value;
  if (safe.points !== undefined) rule.points = Number(safe.points);
  if (safe.priority !== undefined) rule.priority = Number(safe.priority);
  if (safe.active !== undefined) rule.active = Boolean(safe.active);
  rule.version = (rule.version || 1) + 1;

  await rule.save();

  await writeAuditLog({
    tenantContext,
    action: 'score_rule.updated',
    entity_type: 'score_rule',
    entity_id: rule.rule_id,
    before,
    after: rule.toObject(),
    correlation_id,
    ip_address,
  });

  return rule;
};

export const getScoreBands = () => SCORE_BANDS;
