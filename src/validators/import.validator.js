import { body } from 'express-validator';
export const importRowsValidator = [body('rows').optional().isArray().withMessage('rows must be an array')];
