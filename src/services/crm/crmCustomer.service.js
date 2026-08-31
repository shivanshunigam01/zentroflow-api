import Customer from '../../models/Customer.js';
import Opportunity from '../../models/Opportunity.js';
import { buildTenantFilter } from '../../helpers/tenantScope.js';
import { getPagination, paginationMeta } from '../../helpers/pagination.js';
import { assertTenantAccess } from '../../middleware/tenant.middleware.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listCrmCustomers = async (tenantContext, query) => {
  const raw = getPagination(query);
  const limit = Math.min(raw.limit, 100);
  const { page, skip } = raw;
  const filter = buildTenantFilter(tenantContext);

  if (query.search) {
    const term = escapeRegex(query.search.trim());
    filter.$or = [
      { name: { $regex: term, $options: 'i' } },
      { mobile: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
    ];
  }

  const sortField = query.sort === 'name' ? 'name' : 'created_at';
  const sortDir = query.order === 'asc' ? 1 : -1;

  const [total, items] = await Promise.all([
    Customer.countDocuments(filter),
    Customer.find(filter).sort({ [sortField]: sortDir }).skip(skip).limit(limit).lean(),
  ]);

  return { items, meta: paginationMeta({ page, limit, total }) };
};

export const getCrmCustomer360 = async (tenantContext, customerId) => {
  const customer = await Customer.findOne({ customer_id: customerId }).lean();
  if (!customer || !assertTenantAccess(customer, tenantContext)) {
    throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  }

  const leads = await Opportunity.find({
    ...buildTenantFilter(tenantContext),
    customer_id: customerId,
  })
    .sort({ created_at: -1 })
    .limit(50)
    .lean();

  return { customer, leads };
};
