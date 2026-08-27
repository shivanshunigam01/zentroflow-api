import { body } from 'express-validator';

export const createLeadValidator = [
  body('mobile').optional().isString().trim().notEmpty(),
  body('customer_mobile').optional().isString().trim().notEmpty(),
  body().custom((_, { req }) => {
    const mobile = req.body?.mobile ?? req.body?.customer_mobile;
    if (!mobile || !String(mobile).trim()) {
      throw new Error('mobile is required');
    }
    return true;
  }),
  body('customerName').optional().isString().trim().isLength({ max: 120 }),
  body('customer_name').optional().isString().trim().isLength({ max: 120 }),
  body('product').optional().isString().trim().isLength({ max: 120 }),
  body('requirement').optional().isString().trim().isLength({ max: 500 }),
  body('district').optional().isString().trim().isLength({ max: 200 }),
  body('address').optional().isString().trim().isLength({ max: 500 }),
  body('customer_address').optional().isString().trim().isLength({ max: 500 }),
  body('source').optional().isString().trim().isLength({ max: 120 }),
  body('branch').optional().isString().trim().isLength({ max: 120 }),
  body('executive').optional().isString().trim().isLength({ max: 80 }),
  body('current_owner').optional().isString().trim().isLength({ max: 80 }),
  body('email').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('customer_email').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
];
