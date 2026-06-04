import { body, param, query } from 'express-validator';
export const opportunityIdValidator = [param('opportunityId').notEmpty().withMessage('opportunityId is required')];
export const createOpportunityValidator = [body('customer_id').notEmpty().withMessage('customer_id is required'), body('product').notEmpty().withMessage('product is required')];
export const stageTransitionValidator = [body('new_micro_stage').notEmpty().withMessage('new_micro_stage is required')];
export const actionValidator = [body('action_label').notEmpty().withMessage('action_label is required')];
export const listOpportunityValidator = [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })];
