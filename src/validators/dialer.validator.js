import { body, param, query } from 'express-validator';

export const syncLeadIdValidator = [
  param('id').trim().notEmpty().withMessage('lead id is required'),
];

export const bulkSyncValidator = [
  body('leadIds').isArray({ min: 1 }).withMessage('leadIds must be a non-empty array'),
  body('leadIds.*').isString().notEmpty(),
];

export const testSyncValidator = [
  body('leadId').trim().notEmpty().withMessage('leadId is required'),
];

export const dispositionValidator = [
  body('dispositionStatus').trim().notEmpty().withMessage('dispositionStatus is required'),
  body('leadId').optional().isString(),
  body('callId').optional().isString(),
  body('subDispositionStatus').optional().isString(),
  body('note').optional().isString(),
];

export const campaignPatchValidator = [
  body('name').optional().isString(),
  body('description').optional().isString(),
  body('status').optional().isString(),
];

export const callsQueryValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('campaignId').optional().isString().trim().notEmpty(),
  query('agentId').optional().isString().trim().notEmpty(),
  query('status').optional().isString().trim().notEmpty(),
  query('disposition').optional().isString().trim().notEmpty(),
  query('direction').optional().isString().trim().notEmpty(),
  query('leadId').optional().isString().trim().notEmpty(),
  query('callId').optional().isString().trim().notEmpty(),
  query('search').optional().isString().trim().isLength({ max: 120 }),
  query('fromDate').optional().isISO8601(),
  query('toDate').optional().isISO8601(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('dateField').optional().isIn(['created_at', 'start_time']),
];
