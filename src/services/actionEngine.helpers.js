import { getStageMaster, parseSlaToMinutes } from '../constants/stageMaster.js';

export const getActionPatchFromStage = (microStage) => {
  const master = getStageMaster(microStage);
  if (master) {
    const minutes = parseSlaToMinutes(master.defaultSla) ?? 60;
    return {
      current_action: master.currentAction,
      next_action: master.nextAction,
      priority: minutes <= 30 ? 'P1' : minutes <= 120 ? 'P2' : 'P3',
      sla: master.defaultSla,
      next_action_date: new Date(Date.now() + minutes * 60_000),
      escalation_owner: master.nextOwner || 'Sales Manager',
    };
  }
  const n = Number(String(microStage).split('.')[1] || 1);
  const priority = n >= 8 ? 'P1' : n >= 5 ? 'P2' : 'P3';
  return {
    current_action: `Complete ${microStage}`,
    next_action: `Next step after ${microStage}`,
    priority,
    sla: priority === 'P1' ? '4 hours' : '24 hours',
    next_action_date: new Date(Date.now() + (priority === 'P1' ? 4 : 24) * 60 * 60 * 1000),
  };
};

export const resolveOwnerLogic = (logic = '', opp = {}) => {
  const l = String(logic).toUpperCase();
  if (l.includes('SYSTEM') || l === 'BOT') return 'SYSTEM';
  if (l.includes('MANAGER')) return 'Sales Manager';
  if (l.includes('FINANCE')) return 'Finance Executive';
  if (l.includes('STOCK')) return 'Stock Manager';
  if (l.includes('DELIVERY')) return 'Delivery Team';
  if (l.includes('AUTODIALER')) return 'AUTODIALER';
  if (l.includes('CURRENT')) return opp.current_owner || 'Sales Executive';
  return 'Sales Executive';
};

export const evaluateRuleCondition = (rule, ctx) => {
  const field = rule.field_path || rule.field;
  const operator = rule.operator;
  const expected = String(rule.expected_value ?? rule.expectedValue ?? '');
  const actual = ctx[field];
  switch (operator) {
    case 'IS_NOT_NULL':
      return actual !== null && actual !== undefined && actual !== '';
    case 'EQUALS':
      return String(actual).toLowerCase() === expected.toLowerCase();
    case 'IN': {
      const set = expected.split(',').map((s) => s.trim().toUpperCase());
      return set.includes(String(actual).toUpperCase());
    }
    case 'NOT_EQUALS':
      return String(actual) !== expected;
    default:
      return false;
  }
};
