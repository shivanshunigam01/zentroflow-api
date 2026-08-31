import ScoreLedger from '../../models/ScoreLedger.js';
import Opportunity from '../../models/Opportunity.js';
import Customer from '../../models/Customer.js';
import { classifyCrmScore, mapScoreToTemperature, SCORE_BANDS } from '../../constants/crmScoreRules.js';
import { ensureDefaultScoreRules, listScoreRulesForTenant } from './crmScoreRulesAdmin.service.js';
import { assertTenantAccess } from '../../middleware/tenant.middleware.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { writeAuditLog } from '../audit.service.js';

export { ensureDefaultScoreRules };

const evaluateRule = (rule, opportunity, customer) => {
  const field = rule.field;
  if (!field) return false;
  const value = field.startsWith('customer.')
    ? customer?.[field.replace('customer.', '')]
    : opportunity[field];

  switch (rule.operator) {
    case 'eq':
      return String(value ?? '').toLowerCase() === String(rule.expected_value ?? '').toLowerCase();
    case 'gte':
      return Number(value) >= Number(rule.expected_value);
    case 'lte':
      return Number(value) <= Number(rule.expected_value);
    case 'exists':
      return value != null && String(value).trim() !== '';
    default:
      return false;
  }
};

export const recalculateLeadScore = async ({
  tenantContext,
  leadId,
  correlation_id,
  ip_address,
}) => {
  const opportunity = await Opportunity.findOne({
    $or: [{ opportunity_id: leadId }, { lead_id: leadId }],
  });
  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  await ensureDefaultScoreRules();
  const rules = await listScoreRulesForTenant(tenantContext);

  let total = 0;
  const reasons = [];
  const customer = await Customer.findOne({ customer_id: opportunity.customer_id }).lean();

  for (const rule of rules) {
    if (evaluateRule(rule, opportunity, customer)) {
      total += rule.points;
      reasons.push(`${rule.name} (+${rule.points})`);
    }
  }

  const before = {
    lead_score: opportunity.lead_score,
    score_classification: opportunity.score_classification,
    temperature: opportunity.temperature,
  };

  opportunity.lead_score = Math.max(0, Math.min(100, total));
  opportunity.score_classification = classifyCrmScore(opportunity.lead_score);
  opportunity.temperature = mapScoreToTemperature(opportunity.lead_score);
  opportunity.score_version = (opportunity.score_version || 1) + 1;
  opportunity.score_reasons = reasons;
  await opportunity.save();

  await ScoreLedger.create({
    opportunity_id: opportunity.opportunity_id,
    event_type: 'score.recalculated',
    points: opportunity.lead_score,
    score_after: opportunity.lead_score,
    classification_after: opportunity.score_classification,
    reason: reasons.join('; ') || 'No rules matched',
  });

  await writeAuditLog({
    tenantContext,
    action: 'lead.score_recalculated',
    entity_type: 'opportunity',
    entity_id: opportunity.opportunity_id,
    before,
    after: {
      lead_score: opportunity.lead_score,
      score_classification: opportunity.score_classification,
      temperature: opportunity.temperature,
      score_reasons: reasons,
    },
    correlation_id,
    ip_address,
  });

  return {
    opportunity,
    score_reasons: reasons,
    bands: SCORE_BANDS,
  };
};

export const getScoreHistory = async (tenantContext, leadId) => {
  const opportunity = await Opportunity.findOne({
    $or: [{ opportunity_id: leadId }, { lead_id: leadId }],
  }).lean();
  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  const [ledger, rules] = await Promise.all([
    ScoreLedger.find({ opportunity_id: opportunity.opportunity_id }).sort({ created_at: -1 }).limit(50).lean(),
    listScoreRulesForTenant(tenantContext),
  ]);

  return {
    lead_score: opportunity.lead_score,
    score_classification: opportunity.score_classification,
    temperature: opportunity.temperature,
    score_reasons: opportunity.score_reasons || [],
    score_version: opportunity.score_version || 1,
    bands: SCORE_BANDS,
    rules,
    ledger,
  };
};

export const listScoreRules = async (tenantContext) => listScoreRulesForTenant(tenantContext);
