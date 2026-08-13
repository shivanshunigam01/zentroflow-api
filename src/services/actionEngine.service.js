import { randomUUID } from 'crypto';
import Opportunity from '../models/Opportunity.js';
import Action from '../models/Action.js';
import AutomationRule from '../models/AutomationRule.js';
import { getActionPatchFromStage, resolveOwnerLogic, evaluateRuleCondition } from './actionEngine.helpers.js';
import { getStageMaster, parseSlaToMinutes } from '../constants/stageMaster.js';
import { AUTOMATION_RULE_SEEDS, getActiveAutomationRules } from '../constants/automationRules.js';
import { checkGoldenRule, findGoldenRuleExceptions } from './goldenRule.service.js';
import { publishEvent } from './event.service.js';

/** Backward-compatible helper used by engines.controller / stageTransition */
export const getActionPatch = (microStage) => getActionPatchFromStage(microStage);

export const getActionContext = async (opportunityId) => {
  const opp = await Opportunity.findOne({ opportunity_id: opportunityId }).lean();
  if (!opp) return null;

  const action = await Action.findOne({
    opportunity_id: opportunityId,
    status: { $in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] },
  })
    .sort({ due_at: 1 })
    .lean();

  const master = getStageMaster(opp.current_micro_stage);
  const violations = checkGoldenRule(opp);
  const blockers = violations.map((v) => v.field);

  return {
    opportunity_id: opp.opportunity_id,
    lead_id: opp.lead_id,
    stage: opp.current_stage,
    lifecycle_stage: opp.lifecycle_stage,
    micro_stage: opp.current_micro_stage,
    owner: opp.current_owner,
    current_action: opp.current_action,
    next_action: opp.next_action,
    next_action_date: opp.next_action_date,
    sla: opp.sla,
    sla_due_at: opp.sla_due_at,
    sla_status: opp.sla_status,
    score: opp.lead_score,
    score_classification: opp.score_classification,
    priority: opp.priority,
    escalation_owner: opp.escalation_owner,
    status: opp.status,
    next_stage_path: master?.nextStage || null,
    blockers,
    golden_rule_ok: violations.length === 0,
    current_action_record: action
      ? {
          id: action.action_id,
          action_type: action.action_type,
          status: action.status,
          owner_id: action.owner_id,
          due_at: action.due_at,
          priority: action.priority,
        }
      : null,
  };
};

export const runActionEngineOnOpportunity = async (opportunityId) => {
  const opportunity = await Opportunity.findOne({ opportunity_id: opportunityId });
  if (!opportunity) return null;
  const patch = getActionPatchFromStage(opportunity.current_micro_stage);
  Object.assign(opportunity, patch);
  await opportunity.save();
  return opportunity;
};

export const listOpenActions = async (owner) => {
  const q = { status: { $in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] } };
  if (owner) q.owner_id = owner;
  return Action.find(q).sort({ due_at: 1 }).lean();
};

export const acceptAction = async (actionId, actorId = 'user') => {
  const action = await Action.findOne({ action_id: actionId });
  if (!action) return null;
  if (!['PENDING'].includes(action.status)) {
    const err = new Error(`Cannot accept from ${action.status}`);
    err.status = 409;
    throw err;
  }
  action.status = 'ACCEPTED';
  action.version_number += 1;
  action.updated_by = actorId;
  await action.save();
  return action;
};

export const startAction = async (actionId, actorId = 'user') => {
  const action = await Action.findOne({ action_id: actionId });
  if (!action) return null;
  if (!['PENDING', 'ACCEPTED'].includes(action.status)) {
    const err = new Error(`Cannot start from ${action.status}`);
    err.status = 409;
    throw err;
  }
  action.status = 'IN_PROGRESS';
  action.version_number += 1;
  action.updated_by = actorId;
  await action.save();
  return action;
};

export const completeAction = async (actionId, actorId = 'user', completion = {}) => {
  const action = await Action.findOne({ action_id: actionId });
  if (!action) return null;
  if (action.action_type === 'CREATE_QUOTATION_TASK' && !completion.quotation_id) {
    const err = new Error('Completion rejected: quotation_id required');
    err.status = 400;
    throw err;
  }
  action.status = 'COMPLETED';
  action.completion_json = completion;
  action.version_number += 1;
  action.updated_by = actorId;
  await action.save();
  await publishEvent({
    type: 'action.completed',
    opportunity_id: action.opportunity_id,
    customer_id: action.customer_id || 'unknown',
    payload: { action_id: actionId, completion },
  });
  return action;
};

export const reassignAction = async (actionId, newOwner, reason, actorId = 'manager') => {
  const action = await Action.findOne({ action_id: actionId });
  if (!action) return null;
  const from = action.owner_id;
  action.owner_id = newOwner;
  action.version_number += 1;
  action.updated_by = actorId;
  action.reassign_reason = reason;
  await action.save();
  await Opportunity.updateOne(
    { opportunity_id: action.opportunity_id },
    { $set: { current_owner: newOwner } },
  );
  await publishEvent({
    type: 'action.reassigned',
    opportunity_id: action.opportunity_id,
    customer_id: action.customer_id || 'unknown',
    payload: { from, to: newOwner, reason },
  });
  return action;
};

export const ensureSeedRules = async () => {
  const count = await AutomationRule.countDocuments();
  if (count > 0) return;
  await AutomationRule.insertMany(
    AUTOMATION_RULE_SEEDS.map((r) => ({
      rule_id: randomUUID(),
      rule_code: r.ruleCode,
      name: r.name,
      type: r.ruleType,
      trigger_event: r.triggerEvent,
      priority: r.priority,
      status: r.status,
      current_version: r.version || 1,
      field_path: r.field,
      operator: r.operator,
      expected_value: r.expectedValue,
      action_type: r.actionType,
      owner_logic: r.actionOwnerLogic,
      sla_minutes: r.slaMinutes,
      escalation_logic: r.escalationLogic,
      exit_condition: r.exitCondition,
      next_stage: r.nextStage,
      scope: r.scope,
    })),
  );
};

export const listRules = async () => {
  await ensureSeedRules();
  return AutomationRule.find().sort({ priority: 1, rule_code: 1 }).lean();
};

export const createRule = async (body) => {
  const doc = await AutomationRule.create({
    rule_id: randomUUID(),
    rule_code: body.rule_code,
    name: body.name,
    type: body.type || 'EVENT',
    trigger_event: body.trigger_event,
    priority: body.priority || 'P2',
    status: 'DRAFT',
    current_version: 1,
    field_path: body.field_path || '',
    operator: body.operator || 'EQUALS',
    expected_value: body.expected_value || '',
    action_type: body.action_type || 'CREATE_FOLLOWUP_TASK',
    owner_logic: body.owner_logic || 'CURRENT_SALES_OWNER',
    sla_minutes: body.sla_minutes || 60,
    escalation_logic: body.escalation_logic || '',
    exit_condition: body.exit_condition || '',
    next_stage: body.next_stage || '',
    scope: body.scope || 'Organisation/Branch',
  });
  return doc;
};

export const simulateRule = async (ruleId) => {
  const rule = await AutomationRule.findOne({ $or: [{ rule_id: ruleId }, { _id: ruleId }] });
  if (!rule) return null;
  const opps = await Opportunity.find({ status: 'Open' }).lean();
  let matches = 0;
  for (const opp of opps) {
    const ctx = {
      'lead.priority': String(opp.score_classification || '').toUpperCase(),
      'lead.status': opp.status,
      'lead.mobile': 'seed',
    };
    if (evaluateRuleCondition(rule, ctx)) matches += 1;
  }
  return {
    rule_id: rule.rule_id,
    rule_code: rule.rule_code,
    records_evaluated: opps.length,
    matches,
    projected_actions: matches,
    projected_escalations: Math.floor(matches * 0.1),
  };
};

export const activateRule = async (ruleId) => {
  const rule = await AutomationRule.findOne({ $or: [{ rule_id: ruleId }, { _id: ruleId }] });
  if (!rule) return null;
  rule.status = 'ACTIVE';
  await rule.save();
  return rule;
};

export const setRuleStatus = async (ruleId, status) => {
  const rule = await AutomationRule.findOne({ $or: [{ rule_id: ruleId }, { _id: ruleId }] });
  if (!rule) return null;
  rule.status = status;
  await rule.save();
  return rule;
};

export const ingestDomainEvent = async ({
  eventId,
  eventType,
  entityId,
  payload = {},
  idempotencyKey,
}) => {
  // Idempotency via Action unique key when we create actions
  let opp = null;
  if (entityId) opp = await Opportunity.findOne({ opportunity_id: entityId });
  if (!opp && payload.opportunity_id) {
    opp = await Opportunity.findOne({ opportunity_id: payload.opportunity_id });
  }

  const rules = await AutomationRule.find({ status: 'ACTIVE', trigger_event: eventType });
  const seedFallback = !rules.length
    ? getActiveAutomationRules().filter((r) => r.triggerEvent === eventType)
    : [];

  const matched = [];
  const created = [];

  const ruleList = rules.length
    ? rules
    : seedFallback.map((r) => ({
        rule_code: r.ruleCode,
        field_path: r.field,
        operator: r.operator,
        expected_value: r.expectedValue,
        action_type: r.actionType,
        owner_logic: r.actionOwnerLogic,
        priority: r.priority,
        sla_minutes: r.slaMinutes,
        next_stage: r.nextStage,
      }));

  const ctx = {
    ...payload,
    'lead.mobile': payload.mobile || payload['lead.mobile'] || (opp ? 'x' : ''),
    'lead.priority': payload.priority || String(opp?.score_classification || '').toUpperCase(),
    'lead.status': opp?.status || payload.status,
  };

  for (const rule of ruleList) {
    if (!evaluateRuleCondition(rule, ctx)) continue;
    matched.push(rule.rule_code);
    if (!opp) continue;

    const existing = await Action.findOne({
      opportunity_id: opp.opportunity_id,
      action_type: rule.action_type,
      micro_stage: opp.current_micro_stage,
      status: { $in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] },
    });
    if (existing) {
      created.push(existing.action_id);
      continue;
    }

    const due = new Date(Date.now() + (rule.sla_minutes || 60) * 60_000);
    const action = await Action.create({
      action_id: randomUUID(),
      opportunity_id: opp.opportunity_id,
      lead_id: opp.lead_id,
      customer_id: opp.customer_id,
      macro_stage: opp.current_stage,
      micro_stage: opp.current_micro_stage,
      action_type: rule.action_type,
      status: 'PENDING',
      priority: rule.priority || 'P2',
      owner_id: resolveOwnerLogic(rule.owner_logic, opp),
      due_at: due,
      trigger_event_id: eventId,
      trigger_rule_id: rule.rule_code,
      idempotency_key: idempotencyKey || `${opp.opportunity_id}:${rule.action_type}:${opp.current_micro_stage}`,
    });
    created.push(action.action_id);

    opp.current_action = rule.action_type;
    opp.next_action = `Advance toward ${rule.next_stage || 'next'}`;
    opp.current_owner = action.owner_id;
    opp.priority = rule.priority || opp.priority;
    opp.sla = `${rule.sla_minutes || 60} min`;
    opp.sla_due_at = due;
    opp.next_action_date = due;
    await opp.save();
  }

  await publishEvent({
    type: eventType,
    opportunity_id: opp?.opportunity_id || entityId || 'unknown',
    customer_id: opp?.customer_id || 'unknown',
    payload: { eventId, matched, created, idempotencyKey },
  });

  return {
    status: 'accepted',
    opportunity_id: opp?.opportunity_id,
    actions_created: created,
    rules_matched: matched,
  };
};

export const engineHealthSnapshot = async () => {
  const open = await Opportunity.find({ status: 'Open' }).lean();
  const orphans = findGoldenRuleExceptions(open);
  const openActions = await Action.countDocuments({
    status: { $in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] },
  });
  return {
    status: orphans.length ? 'degraded' : 'ok',
    open_opportunities: open.length,
    orphan_leads: orphans.map((o) => ({
      opportunity_id: o.opportunity_id,
      issues: o.violations.map((v) => v.field),
    })),
    queue: {
      open_actions: openActions,
      inbox_pending: 0,
      outbox_pending: 0,
      dead_letters: 0,
      open_sla_breaches: open.filter((o) => o.sla_status === 'Breached').length,
    },
    checked_at: new Date().toISOString(),
  };
};

export const applyStageMasterDefaults = (opportunity, microStage) => {
  const master = getStageMaster(microStage);
  const patch = getActionPatchFromStage(microStage);
  if (!master) return patch;
  const minutes = parseSlaToMinutes(master.defaultSla);
  const due = minutes != null ? new Date(Date.now() + minutes * 60_000) : patch.next_action_date;
  return {
    ...patch,
    current_action: master.currentAction || patch.current_action,
    next_action: master.nextAction || patch.next_action,
    current_owner: master.currentOwner || opportunity.current_owner || patch.current_owner,
    escalation_owner: master.nextOwner || opportunity.escalation_owner || 'Sales Manager',
    sla: master.defaultSla || patch.sla,
    sla_due_at: due,
    next_action_date: due,
  };
};
