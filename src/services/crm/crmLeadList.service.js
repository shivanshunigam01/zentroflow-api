import Opportunity from '../../models/Opportunity.js';
import Customer from '../../models/Customer.js';
import { buildTenantFilter } from '../../helpers/tenantScope.js';
import { getPagination, paginationMeta } from '../../helpers/pagination.js';
import { enrichLeadDto } from '../../helpers/leadDto.js';

const SORT_FIELDS = new Set([
  'created_at',
  'updated_at',
  'last_activity_at',
  'next_action_date',
  'lead_score',
  'current_owner',
  'source',
]);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listCrmLeads = async (tenantContext, query) => {
  const raw = getPagination(query);
  const limit = Math.min(raw.limit, 100);
  const { page, skip } = raw;
  const filter = buildTenantFilter(tenantContext);

  if (query.stage) {
    if (query.stage === 'lifecycle') filter.lifecycle_stage = { $ne: null };
    else filter.current_stage = query.stage;
  }
  if (query.owner) filter.current_owner = query.owner;
  if (query.source) filter.source = query.source;
  if (query.status) filter.status = query.status;
  if (query.qualification_status) filter.qualification_status = query.qualification_status;
  if (query.duplicate_status) filter.duplicate_status = query.duplicate_status;
  if (query.score_classification) filter.score_classification = query.score_classification;
  if (query.temperature) filter.temperature = query.temperature;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  if (query.followup_status === 'overdue') {
    filter.next_action_date = { $lt: startOfDay };
    filter.status = { $in: ['Open', 'Hold'] };
  } else if (query.followup_status === 'today') {
    filter.next_action_date = { $gte: startOfDay, $lte: endOfDay };
    filter.status = { $in: ['Open', 'Hold'] };
  } else if (query.followup_status === 'upcoming') {
    filter.next_action_date = { $gt: endOfDay };
    filter.status = { $in: ['Open', 'Hold'] };
  }

  if (query.date_from || query.date_to) {
    filter.created_at = {};
    if (query.date_from) filter.created_at.$gte = new Date(query.date_from);
    if (query.date_to) filter.created_at.$lte = new Date(query.date_to);
  }

  if (query.search) {
    const term = escapeRegex(query.search.trim());
    const customers = await Customer.find({
      ...buildTenantFilter(tenantContext),
      $or: [
        { name: { $regex: term, $options: 'i' } },
        { mobile: { $regex: term, $options: 'i' } },
        { mobile_normalized: { $regex: term, $options: 'i' } },
      ],
    })
      .limit(200)
      .select('customer_id')
      .lean();
    const customerIds = customers.map((c) => c.customer_id);
    filter.$or = [
      { lead_id: { $regex: term, $options: 'i' } },
      { opportunity_id: { $regex: term, $options: 'i' } },
      { campaign: { $regex: term, $options: 'i' } },
      ...(customerIds.length ? [{ customer_id: { $in: customerIds } }] : []),
    ];
  }

  const sortField = SORT_FIELDS.has(query.sort) ? query.sort : 'created_at';
  const sortDir = query.order === 'asc' ? 1 : -1;
  const sort = { [sortField]: sortDir };

  const [total, rows] = await Promise.all([
    Opportunity.countDocuments(filter),
    Opportunity.find(filter).sort(sort).skip(skip).limit(limit).lean(),
  ]);

  const items = await Promise.all(rows.map(enrichLeadDto));

  return {
    items,
    meta: paginationMeta({ page, limit, total }),
  };
};
