import { Router } from 'express';
import { runActionEngine, scoreApply, slaState, verifyContact } from '../controllers/engines.controller.js';
const router = Router();
router.post('/action/run', runActionEngine);
router.post('/contact-health/verify', verifyContact);
router.post('/scoring/apply', scoreApply);
router.get('/sla/:opportunityId', slaState);
export default router;
