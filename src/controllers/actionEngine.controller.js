import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';
import {
  acceptAction,
  activateRule,
  completeAction,
  createRule,
  engineHealthSnapshot,
  getActionContext,
  ingestDomainEvent,
  listOpenActions,
  listRules,
  reassignAction,
  setRuleStatus,
  simulateRule,
  startAction,
} from '../services/actionEngine.service.js';

const mapAction = (a) => ({
  id: a.action_id || a.id,
  action_id: a.action_id,
  opportunity_id: a.opportunity_id,
  lead_id: a.lead_id,
  action_type: a.action_type,
  status: a.status,
  priority: a.priority,
  owner_id: a.owner_id,
  due_at: a.due_at,
  micro_stage: a.micro_stage,
  trigger_rule_id: a.trigger_rule_id,
  version_number: a.version_number,
});

const mapRule = (r) => ({
  id: r.rule_id,
  rule_id: r.rule_id,
  rule_code: r.rule_code,
  name: r.name,
  type: r.type,
  trigger_event: r.trigger_event,
  priority: r.priority,
  status: r.status,
  current_version: r.current_version,
  field_path: r.field_path,
  operator: r.operator,
  expected_value: r.expected_value,
  action_type: r.action_type,
  owner_logic: r.owner_logic,
  sla_minutes: r.sla_minutes,
  next_stage: r.next_stage,
});

export const actionContext = asyncHandler(async (req, res) => {
  const ctx = await getActionContext(req.params.opportunityId || req.params.id);
  if (!ctx) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');
  ok(res, ctx);
});

export const postDomainEvent = asyncHandler(async (req, res) => {
  const { eventId, eventType, entityId, payload, idempotencyKey, occurredAt } = req.body || {};
  if (!eventId || !eventType || !idempotencyKey) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'eventId, eventType, and idempotencyKey are required');
  }
  const result = await ingestDomainEvent({
    eventId,
    eventType,
    entityId,
    payload,
    idempotencyKey,
    occurredAt,
  });
  ok(res, result);
});

export const listActions = asyncHandler(async (req, res) => {
  const rows = await listOpenActions(req.query.owner);
  ok(res, rows.map(mapAction));
});

export const postAccept = asyncHandler(async (req, res) => {
  const action = await acceptAction(req.params.id, req.body?.actorId || req.user?.name || 'user');
  if (!action) throw new ApiError(404, 'ACTION_NOT_FOUND', 'Action not found');
  ok(res, mapAction(action));
});

export const postStart = asyncHandler(async (req, res) => {
  try {
    const action = await startAction(req.params.id, req.body?.actorId || 'user');
    if (!action) throw new ApiError(404, 'ACTION_NOT_FOUND', 'Action not found');
    ok(res, mapAction(action));
  } catch (e) {
    if (e.status === 409) throw new ApiError(409, 'CONFLICT', e.message);
    throw e;
  }
});

export const postComplete = asyncHandler(async (req, res) => {
  try {
    const action = await completeAction(
      req.params.id,
      req.body?.actorId || 'user',
      req.body?.completion || {},
    );
    if (!action) throw new ApiError(404, 'ACTION_NOT_FOUND', 'Action not found');
    ok(res, mapAction(action));
  } catch (e) {
    if (e.status === 400) throw new ApiError(400, 'VALIDATION_ERROR', e.message);
    throw e;
  }
});

export const postReassign = asyncHandler(async (req, res) => {
  const { newOwner, reason } = req.body || {};
  if (!newOwner || !reason) throw new ApiError(400, 'VALIDATION_ERROR', 'newOwner and reason required');
  const action = await reassignAction(req.params.id, newOwner, reason, req.body?.actorId || 'manager');
  if (!action) throw new ApiError(404, 'ACTION_NOT_FOUND', 'Action not found');
  ok(res, mapAction(action));
});

export const getEngineHealth = asyncHandler(async (_req, res) => {
  ok(res, await engineHealthSnapshot());
});

export const getRules = asyncHandler(async (_req, res) => {
  const rows = await listRules();
  ok(res, rows.map(mapRule));
});

export const postRule = asyncHandler(async (req, res) => {
  if (!req.body?.rule_code || !req.body?.name || !req.body?.trigger_event) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'rule_code, name, trigger_event required');
  }
  ok(res, mapRule(await createRule(req.body)), { status: 201 });
});

export const postSimulate = asyncHandler(async (req, res) => {
  const result = await simulateRule(req.params.id);
  if (!result) throw new ApiError(404, 'RULE_NOT_FOUND', 'Rule not found');
  ok(res, result);
});

export const postActivate = asyncHandler(async (req, res) => {
  const rule = await activateRule(req.params.id);
  if (!rule) throw new ApiError(404, 'RULE_NOT_FOUND', 'Rule not found');
  ok(res, mapRule(rule));
});

export const postShadow = asyncHandler(async (req, res) => {
  const rule = await setRuleStatus(req.params.id, 'SHADOW');
  if (!rule) throw new ApiError(404, 'RULE_NOT_FOUND', 'Rule not found');
  ok(res, mapRule(rule));
});

export const postPause = asyncHandler(async (req, res) => {
  const rule = await setRuleStatus(req.params.id, 'PAUSED');
  if (!rule) throw new ApiError(404, 'RULE_NOT_FOUND', 'Rule not found');
  ok(res, mapRule(rule));
});
