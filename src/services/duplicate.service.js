import Opportunity from '../models/Opportunity.js';
import { env } from '../config/env.js';
import { buildTenantFilter } from '../helpers/tenantScope.js';

const ACTIVE_STATUSES = ['Open', 'Hold'];

const normalize = (value) => String(value ?? '').trim().toLowerCase();

const daysSince = (date) => (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);

/**
 * Exact duplicate: same customer + product + requirement + active + activity within window.
 * Tenant-scoped when tenantContext is provided.
 */
export const classifyDuplicate = async ({ customer_id, product, requirement = null, tenantContext = null }) => {
  const since = new Date(Date.now() - env.DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const productKey = normalize(product);
  const reqKey = normalize(requirement);

  const baseFilter = tenantContext
    ? buildTenantFilter(tenantContext, { customer_id, status: { $in: ACTIVE_STATUSES }, last_activity_at: { $gte: since } })
    : { customer_id, status: { $in: ACTIVE_STATUSES }, last_activity_at: { $gte: since } };

  const existing = await Opportunity.find(baseFilter).lean();

  const exact = existing.find(
    (o) => normalize(o.product) === productKey && normalize(o.requirement) === reqKey && daysSince(o.last_activity_at) < env.DUPLICATE_WINDOW_DAYS,
  );

  return exact ? { duplicate: true, opportunity: exact } : { duplicate: false };
};
