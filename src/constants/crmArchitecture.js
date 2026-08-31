/**
 * CRM architecture boundaries — Phase 2.5 documentation.
 * CRM Followup and Action Engine remain separate systems.
 */

export const CRM_FOLLOWUP_RESPONSIBILITIES = {
  system: 'CRM Followup',
  purpose: 'Human sales follow-up scheduling and completion',
  responsibilities: [
    'Scheduled calls and customer callbacks',
    'Sales reminders and due-date tracking',
    'Follow-up completion and outcome recording',
    'Overdue / today / upcoming queue views',
  ],
  notResponsibleFor: [
    'System automation triggers',
    'SLA escalation rules',
    'Next-best-action recommendations',
  ],
};

export const ACTION_ENGINE_RESPONSIBILITIES = {
  system: 'Action Engine',
  purpose: 'System and business automation',
  responsibilities: [
    'Rule-based next actions',
    'SLA timers and escalation',
    'Automated task generation',
    'Business workflow automation',
  ],
  notResponsibleFor: [
    'Manual sales callback scheduling',
    'Human follow-up completion tracking',
  ],
};
