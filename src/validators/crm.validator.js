import { body, param, query } from 'express-validator';

export const listLeadsValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['created_at', 'updated_at', 'last_activity_at', 'next_action_date', 'lead_score', 'current_owner', 'source']),
  query('order').optional().isIn(['asc', 'desc']),
  query('qualification_status').optional().isIn(['PENDING', 'QUALIFIED', 'DISQUALIFIED']),
  query('duplicate_status').optional().isIn(['NEW', 'LIKELY_DUPLICATE', 'CONFIRMED_DUPLICATE']),
  query('score_classification').optional().isIn(['Cold', 'Warm', 'Hot', 'Critical']),
  query('temperature').optional().isIn(['COLD', 'WARM', 'HOT', 'NURTURE']),
  query('followup_status').optional().isIn(['overdue', 'today', 'upcoming']),
];

export const listCustomersValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['created_at', 'name']),
  query('order').optional().isIn(['asc', 'desc']),
];

export const listFollowupsValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('view').optional().isIn(['today', 'overdue', 'upcoming']),
  query('status').optional().isIn(['OPEN', 'DUE', 'COMPLETED', 'MISSED', 'RESCHEDULED', 'CANCELLED']),
];

export const leadIdParam = [param('id').trim().notEmpty()];

export const followupIdParam = [param('id').trim().notEmpty()];

export const customerIdParam = [param('id').trim().notEmpty()];

export const changeStageValidator = [
  ...leadIdParam,
  body('new_micro_stage').trim().notEmpty().withMessage('new_micro_stage is required'),
  body('reason').optional().isString(),
  body('force').optional().isBoolean(),
];

export const assignLeadValidator = [
  ...leadIdParam,
  body('new_owner').trim().notEmpty().withMessage('new_owner is required'),
  body('reason').optional().isString(),
];

export const createFollowupValidator = [
  ...leadIdParam,
  body('scheduled_at').notEmpty().withMessage('scheduled_at is required'),
  body('followup_type').optional().isIn(['CALL', 'WHATSAPP', 'EMAIL', 'SMS', 'VISIT', 'TEST_DRIVE', 'VIDEO_CALL', 'OTHER']),
  body('assigned_to').optional().isString(),
  body('remarks').optional().isString(),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
];

export const updateFollowupValidator = [
  ...followupIdParam,
  body('status').optional().isIn(['OPEN', 'DUE', 'COMPLETED', 'MISSED', 'RESCHEDULED', 'CANCELLED']),
  body('outcome').optional().isString(),
  body('remarks').optional().isString(),
  body('scheduled_at').optional().isISO8601(),
  body('assigned_to').optional().isString(),
];

export const qualifyValidator = [
  ...leadIdParam,
  body('notes').optional().isString(),
];

export const disqualifyValidator = [
  ...leadIdParam,
  body('reason').trim().notEmpty().withMessage('reason is required'),
];

export const dedupeActionValidator = [
  ...leadIdParam,
  body('target_opportunity_id').optional().trim().notEmpty(),
  body('reason').optional().isString(),
];

export const mergeValidator = [
  ...leadIdParam,
  body('target_opportunity_id').trim().notEmpty().withMessage('target_opportunity_id is required'),
  body('reason').optional().isString(),
];

export const scoreRuleIdParam = [param('id').trim().notEmpty()];

const SCORE_RULE_FIELDS = [
  'purchase_timeline', 'verification_status', 'product', 'qualification_status',
  'temperature', 'lead_score', 'source', 'current_stage', 'customer.mobile', 'customer.email',
];

export const createScoreRuleValidator = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('rule_code').optional().isString(),
  body('field').optional().isIn(SCORE_RULE_FIELDS),
  body('operator').optional().isIn(['eq', 'gte', 'lte', 'exists', 'event']),
  body('expected_value').optional().isString(),
  body('points').optional().isInt({ min: -100, max: 100 }),
  body('priority').optional().isInt({ min: 1, max: 9999 }),
  body('active').optional().isBoolean(),
];

export const updateScoreRuleValidator = [
  ...scoreRuleIdParam,
  body('name').optional().trim().notEmpty(),
  body('field').optional().isIn(SCORE_RULE_FIELDS),
  body('operator').optional().isIn(['eq', 'gte', 'lte', 'exists', 'event']),
  body('expected_value').optional().isString(),
  body('points').optional().isInt({ min: -100, max: 100 }),
  body('priority').optional().isInt({ min: 1, max: 9999 }),
  body('active').optional().isBoolean(),
];
