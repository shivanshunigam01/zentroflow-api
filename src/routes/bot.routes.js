import { Router } from 'express';
import { body } from 'express-validator';
import { getBotJourney, mindAssist, sendBotMessage } from '../controllers/bot.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/journey/:opportunityId', getBotJourney);
router.post(
  '/message',
  [body('opportunity_id').notEmpty(), body('message').optional().isString()],
  validate,
  sendBotMessage,
);
router.post(
  '/mind',
  [body('prompt').notEmpty()],
  validate,
  mindAssist,
);

export default router;
