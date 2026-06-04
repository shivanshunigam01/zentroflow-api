import { Router } from 'express';
import { body } from 'express-validator';
import { login, me } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  login,
);

router.get('/me', requireAuth, me);

export default router;
