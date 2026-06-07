import { Router } from 'express';
import { smartfloBatchStatus, smartfloConfigStatus, syncSmartfloLeads } from '../controllers/smartflo.controller.js';

const router = Router();

router.get('/smartflo/config', smartfloConfigStatus);
router.post('/smartflo/sync-leads', syncSmartfloLeads);
router.get('/smartflo/batch-status/:batchId', smartfloBatchStatus);

export default router;
