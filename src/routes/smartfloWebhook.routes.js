import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ok } from '../helpers/apiResponse.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { processSmartfloWebhook, verifyWebhookSecret } from '../services/smartflo/smartflo.webhook.service.js';

const router = Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const handleWebhook = asyncHandler(async (req, res) => {
  verifyWebhookSecret(req);
  const result = await processSmartfloWebhook(req.body);
  ok(res, { received: true, ...result });
});

router.post('/webhooks/smartflo/dialer', webhookLimiter, handleWebhook);
router.post('/integrations/smartflo/webhook', webhookLimiter, handleWebhook);

export default router;
