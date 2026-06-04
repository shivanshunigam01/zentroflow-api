import Customer from '../models/Customer.js';
import Opportunity from '../models/Opportunity.js';
import LeadActivity from '../models/LeadActivity.js';
import StageHistory from '../models/StageHistory.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';
import { getPagination, paginationMeta } from '../helpers/pagination.js';
import { generateIds } from '../services/idGeneration.service.js';
import { moveStage } from '../services/stageTransition.service.js';
import { performAction } from '../services/opportunityAction.service.js';
import { classifyDuplicate } from '../services/duplicate.service.js';

const withCustomer = async (opportunity) => {
  const customer = await Customer.findOne({ customer_id: opportunity.customer_id }).lean();
  return { ...opportunity.toObject?.() || opportunity, customer_name: customer?.name, customer_mobile: customer?.mobile };
};

export const listOpportunities = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  ['current_stage', 'current_owner', 'priority', 'status', 'sla_status', 'customer_id'].forEach((key) => {
    const queryKey = key === 'current_stage' ? 'stage' : key === 'current_owner' ? 'owner' : key;
    if (req.query[queryKey]) filter[key] = req.query[queryKey];
  });
  const [rows, total] = await Promise.all([Opportunity.find(filter).sort({ updated_at: -1 }).skip(skip).limit(limit), Opportunity.countDocuments(filter)]);
  const data = await Promise.all(rows.map(withCustomer));
  ok(res, data, paginationMeta({ page, limit, total }));
});

export const getOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findOne({ opportunity_id: req.params.opportunityId });
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');
  ok(res, await withCustomer(opportunity));
});

export const createOpportunity = asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ customer_id: req.body.customer_id });
  if (!customer) throw new ApiError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found');
  const duplicate = await classifyDuplicate({ customer_id: customer.customer_id, product: req.body.product, requirement: req.body.requirement ?? null });
  if (duplicate.duplicate) throw new ApiError(409, 'DUPLICATE_LEAD', 'Exact duplicate opportunity found in duplicate window', 'product');
  const ids = generateIds(customer.name);
  const opportunity = await Opportunity.create({
    opportunity_id: req.body.opportunity_id || ids.opportunity_id,
    lead_id: req.body.lead_id || ids.lead_id,
    customer_id: customer.customer_id,
    product: req.body.product,
    variant: req.body.variant,
    requirement: req.body.requirement,
    opportunity_type: req.body.opportunity_type || 'New',
    current_owner: req.body.current_owner || req.body.owner || 'Sales Executive',
    source: req.body.source || 'Manual',
    campaign: req.body.campaign,
    branch: req.body.branch || 'Default Branch',
    escalation_owner: req.body.escalation_owner || 'Sales Manager',
  });
  ok(res.status(201), await withCustomer(opportunity));
});

export const updateOpportunity = asyncHandler(async (req, res) => {
  const allowed = ['current_owner', 'current_action', 'next_action', 'next_action_date', 'priority', 'status', 'source', 'campaign', 'branch', 'requirement', 'variant'];
  const patch = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  const opportunity = await Opportunity.findOneAndUpdate({ opportunity_id: req.params.opportunityId }, patch, { new: true });
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');
  ok(res, await withCustomer(opportunity));
});

export const stageTransition = asyncHandler(async (req, res) => {
  const opportunity = await moveStage({ opportunity_id: req.params.opportunityId, new_micro_stage: req.body.new_micro_stage, changed_by: req.body.changed_by || req.user?.name || 'System', reason: req.body.reason, force: req.body.force, correlation_id: res.locals.correlationId });
  ok(res, await withCustomer(opportunity));
});

export const runAction = asyncHandler(async (req, res) => {
  const opportunity = await performAction({ opportunity_id: req.params.opportunityId, action_label: req.body.action_label, changed_by: req.body.changed_by || req.user?.name || 'System', force: req.body.force, reason: req.body.reason, correlation_id: res.locals.correlationId });
  ok(res, await withCustomer(opportunity));
});

export const getActivities = asyncHandler(async (req, res) => {
  ok(res, await LeadActivity.find({ opportunity_id: req.params.opportunityId }).sort({ created_at: -1 }));
});

export const getStageHistory = asyncHandler(async (req, res) => {
  ok(res, await StageHistory.find({ opportunity_id: req.params.opportunityId }).sort({ created_at: -1 }));
});
