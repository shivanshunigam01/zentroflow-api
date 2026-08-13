import { getStageMaster } from '../constants/stageMaster.js';

/**
 * Spec sheet 00 — every open opportunity needs stage, owner, action, due time, next path.
 */
export const checkGoldenRule = (opp) => {
  if (opp.status !== 'Open') return [];
  const violations = [];
  if (!opp.current_micro_stage) violations.push({ field: 'current_micro_stage', reason: 'Missing micro stage' });
  if (!String(opp.current_owner || '').trim()) violations.push({ field: 'current_owner', reason: 'Missing current owner' });
  if (!String(opp.current_action || '').trim()) violations.push({ field: 'current_action', reason: 'Missing current action' });
  if (!String(opp.next_action || '').trim()) violations.push({ field: 'next_action', reason: 'Missing next action' });
  if (!opp.next_action_date && !opp.sla_due_at) {
    violations.push({ field: 'due_time', reason: 'Missing due time (next_action_date or sla_due_at)' });
  }
  if (!String(opp.sla || '').trim()) violations.push({ field: 'sla', reason: 'Missing SLA' });
  if (!opp.current_stage && !opp.lifecycle_stage) {
    violations.push({ field: 'current_stage', reason: 'Missing macro or lifecycle stage' });
  }
  const master = getStageMaster(opp.current_micro_stage);
  if (!master) {
    violations.push({ field: 'current_micro_stage', reason: `Unknown micro stage ${opp.current_micro_stage}` });
  } else if (!String(master.nextStage || '').trim()) {
    violations.push({ field: 'next_stage_path', reason: 'No valid next-stage path' });
  }
  return violations;
};

export const findGoldenRuleExceptions = (opportunities) =>
  opportunities
    .filter((o) => o.status === 'Open')
    .map((o) => ({ opportunity_id: o.opportunity_id, violations: checkGoldenRule(o) }))
    .filter((r) => r.violations.length > 0);
