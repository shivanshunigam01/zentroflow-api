import Customer from '../models/Customer.js';
import Opportunity from '../models/Opportunity.js';
import LeadActivity from '../models/LeadActivity.js';
import ImportBatch from '../models/ImportBatch.js';
import { enrichLeadDto } from '../helpers/leadDto.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';

const withCustomer = enrichLeadDto;

export const bootstrap = asyncHandler(async (req, res) => {
  const cap = env.BOOTSTRAP_MAX_LEADS;
  const [customers, opportunities, activities, lastImport] = await Promise.all([
    Customer.find().sort({ updated_at: -1 }).limit(cap).lean(),
    Opportunity.find().sort({ updated_at: -1 }).limit(cap),
    LeadActivity.find().sort({ created_at: -1 }).limit(2000).lean(),
    ImportBatch.findOne().sort({ created_at: -1 }).lean(),
  ]);

  const opportunityDtos = await Promise.all(opportunities.map(withCustomer));

  ok(res, {
    customers,
    opportunities: opportunityDtos,
    activities,
    lastImport,
  });
});
