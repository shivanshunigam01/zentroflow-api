import { Router } from 'express';
import { smartfloClickToCall } from '../controllers/smartflo.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { clickToCallValidator } from '../validators/smartflo.validator.js';

const router = Router();

/**
 * Click-to-Call — mounted at /api/v1/smartflo (see routes/index.js)
 *
 * curl -X POST http://localhost:8787/api/v1/smartflo/call \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT" \
 *   -d '{"phoneNumber":"917247650665"}'
 */
router.post('/call', clickToCallValidator, validate, smartfloClickToCall);

export default router;
