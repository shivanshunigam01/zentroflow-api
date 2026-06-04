import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import authRoutes from './auth.routes.js';
import bootstrapRoutes from './bootstrap.routes.js';
import botRoutes from './bot.routes.js';
import customersRoutes from './customers.routes.js';
import opportunitiesRoutes from './opportunities.routes.js';
import leadsRoutes from './leads.routes.js';
import activitiesRoutes from './activities.routes.js';
import enginesRoutes from './engines.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import reportsRoutes from './reports.routes.js';
import accessRoutes from './access.routes.js';

const router = Router();

router.get('/health', (req, res) =>
  res.json({ data: { status: 'ok' }, meta: { correlation_id: res.locals.correlationId } }),
);

router.use('/auth', authRoutes);
router.use('/bootstrap', bootstrapRoutes);
router.use(requireAuth);

router.use('/customers', customersRoutes);
router.use('/opportunities', opportunitiesRoutes);
router.use('/leads', leadsRoutes);
router.use('/activities', activitiesRoutes);
router.use('/engines', enginesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/access', accessRoutes);
router.use('/bot', botRoutes);

export default router;
