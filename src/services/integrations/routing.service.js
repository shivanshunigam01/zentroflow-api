import { randomUUID } from 'crypto';
import RoutingRule from '../../models/integrations/RoutingRule.js';
import AssignmentHistory from '../../models/crm/AssignmentHistory.js';
import { buildTenantFilter } from '../../helpers/tenantScope.js';

export const applyRouting = async ({ tenantContext, opportunity, normalized, mapping }) => {
  const rules = await RoutingRule.find({
    ...buildTenantFilter(tenantContext),
    active: true,
  }).sort({ priority: 1 }).lean();

  let matched = null;
  for (const rule of rules) {
    const m = rule.match || {};
    if (m.platform && m.platform !== normalized.platform) continue;
    if (m.source && m.source !== opportunity.source) continue;
    if (m.meta_form_id && m.meta_form_id !== normalized.form_id) continue;
    if (m.campaign && m.campaign !== opportunity.campaign) continue;
    if (m.product && m.product !== opportunity.product) continue;
    matched = rule;
    break;
  }

  const assign = matched?.assign || {};
  const previousOwner = opportunity.current_owner;
  const newOwner = assign.owner || mapping?.default_owner || opportunity.current_owner;

  if (assign.dealer_id) opportunity.dealer_id = assign.dealer_id;
  if (assign.branch_id) opportunity.branch_id = assign.branch_id;
  if (newOwner && newOwner !== previousOwner) {
    opportunity.current_owner = newOwner;
    await AssignmentHistory.create({
      assignment_id: `ASG-${randomUUID().slice(0, 8).toUpperCase()}`,
      opportunity_id: opportunity.opportunity_id,
      tenant_id: tenantContext.tenant_id,
      organization_id: tenantContext.organization_id,
      dealer_id: opportunity.dealer_id,
      branch_id: opportunity.branch_id,
      previous_owner: previousOwner,
      new_owner: newOwner,
      assigned_by: 'routing_engine',
      reason: matched ? `Routing rule: ${matched.name}` : 'Form mapping default owner',
    });
  }

  await opportunity.save();
  return { rule: matched?.rule_id || null, owner: opportunity.current_owner };
};

export const listRoutingRules = async (tenantContext) =>
  RoutingRule.find(buildTenantFilter(tenantContext)).sort({ priority: 1 }).lean();

export const createRoutingRule = async ({ tenantContext, body }) => {
  const rule = await RoutingRule.create({
    rule_id: `RR-${randomUUID().slice(0, 8).toUpperCase()}`,
    tenant_id: tenantContext.tenant_id,
    organization_id: tenantContext.organization_id,
    name: body.name,
    active: body.active !== false,
    priority: body.priority || 100,
    match: body.match || {},
    assign: body.assign || {},
  });
  return rule;
};
