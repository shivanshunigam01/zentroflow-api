import { Router } from 'express';
import { bootstrap } from '../controllers/bootstrap.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.get('/', requireAuth, bootstrap);
export default router;
