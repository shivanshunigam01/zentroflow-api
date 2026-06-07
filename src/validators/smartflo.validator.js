import { body } from 'express-validator';

export const clickToCallValidator = [
  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('phoneNumber is required'),
  body('opportunityId').optional().isString(),
  body('customerName').optional().isString(),
];
