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
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
];
