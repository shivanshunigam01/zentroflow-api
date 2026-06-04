import { Router } from 'express';
import { ok } from '../helpers/apiResponse.js';
const router = Router();
router.get('/modules', (req, res) => ok(res, { dashboard: { allowed: true }, leads: { allowed: true }, customers: { allowed: true }, reports: { allowed: true } }));
export default router;
