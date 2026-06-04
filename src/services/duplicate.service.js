import Opportunity from '../models/Opportunity.js';
import { env } from '../config/env.js';

const ACTIVE_STATUSES = ['Open', 'Hold'];

const normalize = (value) => String(value ?? '').trim().toLowerCase();

const daysSince = (date) => (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);

/**
 * Exact duplicate: same customer + product + requirement + active + activity within window.
 * Mirrors zentroverse-buddy/src/domain/duplicate/rules.ts
 */
export const classifyDuplicate = async ({ customer_id, product, requirement = null }) => {
  const since = new Date(Date.now() - env.DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const productKey = normalize(product);
  const reqKey = normalize(requirement);

  const existing = await Opportunity.find({
    customer_id,
    status: { $in: ACTIVE_STATUSES },
    last_activity_at: { $gte: since },
  }).lean();

  const exact = existing.find(
    (o) => normalize(o.product) === productKey && normalize(o.requirement) === reqKey && daysSince(o.last_activity_at) < env.DUPLICATE_WINDOW_DAYS,
  );

  return exact ? { duplicate: true, opportunity: exact } : { duplicate: false };
};
