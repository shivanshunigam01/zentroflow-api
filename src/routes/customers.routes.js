import { Router } from 'express';
import { createCustomer, getCustomer, listCustomers } from '../controllers/customers.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { createCustomerValidator, customerIdValidator, listCustomerValidator } from '../validators/customer.validator.js';
const router = Router();
router.get('/', listCustomerValidator, validate, listCustomers);
router.get('/:customerId', customerIdValidator, validate, getCustomer);
router.post('/', createCustomerValidator, validate, createCustomer);
export default router;
