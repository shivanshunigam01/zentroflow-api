import { Router } from 'express';
import { smartfloClickToCall, smartfloDirectAgentCall } from '../controllers/smartflo.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { clickToCallValidator } from '../validators/smartflo.validator.js';

const router = Router();

/**
 * IVR Click-to-Call Support — mounted at /api/v1/smartflo
 *
 * curl -X POST http://localhost:8787/api/v1/smartflo/call \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT" \
 *   -d '{"phoneNumber":"917247650665"}'
 */
router.post('/call', clickToCallValidator, validate, smartfloClickToCall);

/**
 * Direct agent Click-to-Call — /v1/click_to_call (Bearer SMARTFLO_API_TOKEN)
 *
 * curl -X POST http://localhost:8787/api/v1/smartflo/agent-call \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_JWT" \
 *   -d '{"phoneNumber":"917247650665"}'
 */
router.post('/agent-call', clickToCallValidator, validate, smartfloDirectAgentCall);

export default router;
