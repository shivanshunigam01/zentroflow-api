import { body, param, query } from 'express-validator';
export const createCustomerValidator = [body('name').notEmpty().withMessage('name is required'), body('mobile').notEmpty().withMessage('mobile is required')];
export const customerIdValidator = [param('customerId').notEmpty().withMessage('customerId is required')];
export const listCustomerValidator = [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })];
