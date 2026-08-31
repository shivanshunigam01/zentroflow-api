import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  metaCallback,
  googleCallback,
  metaWebhookVerify,
  metaWebhookReceive,
} from '../controllers/integrations/integrations.controller.js';

const router = Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/integrations/meta/webhook', webhookLimiter, metaWebhookVerify);
router.post('/integrations/meta/webhook', webhookLimiter, metaWebhookReceive);
router.get('/integrations/meta/callback', oauthLimiter, metaCallback);
router.get('/integrations/google/callback', oauthLimiter, googleCallback);

export default router;
