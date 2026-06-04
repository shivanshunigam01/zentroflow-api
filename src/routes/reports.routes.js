import { Router } from 'express';
import { exportReport, pipeline } from '../controllers/reports.controller.js';
const router = Router();
router.get('/pipeline', pipeline);
router.get('/export', exportReport);
export default router;
