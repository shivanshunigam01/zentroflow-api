import { Router } from 'express';
import { sendHealth } from '../helpers/healthHandlers.js';
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
import adminRoutes from './admin.routes.js';
import smartfloRoutes from './smartflo.routes.js';
import actionEngineRoutes from './actionEngine.routes.js';
import mastersRoutes from './masters.routes.js';
import dialerRoutes from './dialer.routes.js';
import smartfloWebhookRoutes from './smartfloWebhook.routes.js';

const router = Router();

router.get('/health', sendHealth);

router.use('/auth', authRoutes);
router.use('/bootstrap', bootstrapRoutes);
router.use(smartfloWebhookRoutes);
router.use(requireAuth);

router.use('/customers', customersRoutes);
router.use('/opportunities', opportunitiesRoutes);
router.use('/leads', leadsRoutes);
router.use('/activities', activitiesRoutes);
router.use('/engines', enginesRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/access', accessRoutes);
router.use('/admin', adminRoutes);
router.use('/smartflo', smartfloRoutes);
router.use('/dialer', dialerRoutes);
router.use('/bot', botRoutes);

/** Spec Action Engine + masters (Stage Master / rules / tasks) */
router.use(actionEngineRoutes);
router.use('/masters', mastersRoutes);

export default router;
