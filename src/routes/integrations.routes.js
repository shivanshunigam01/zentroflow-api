import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { resolveTenantContext } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import {
  metaConnect,
  metaAccounts,
  metaForms,
  metaMapForm,
  metaDisconnect,
  metaHealth,
  googleConnect,
  googleAccounts,
  googleDisconnect,
  googleHealth,
  integrationsHealth,
  listRouting,
  createRouting,
} from '../controllers/integrations/integrations.controller.js';

const router = Router();
router.use(resolveTenantContext);

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/integrations/meta/connect', oauthLimiter, requirePermission('integration:manage'), metaConnect);
router.get('/integrations/meta/accounts', requirePermission('integration:view'), metaAccounts);
router.get('/integrations/meta/forms', requirePermission('integration:view'), metaForms);
router.post('/integrations/meta/forms/:formId/map', requirePermission('integration:manage'), metaMapForm);
router.get('/integrations/meta/health', requirePermission('integration:view'), metaHealth);
router.post('/integrations/meta/disconnect', requirePermission('integration:manage'), metaDisconnect);

router.post('/integrations/google/connect', oauthLimiter, requirePermission('integration:manage'), googleConnect);
router.get('/integrations/google/accounts', requirePermission('integration:view'), googleAccounts);
router.get('/integrations/google/health', requirePermission('integration:view'), googleHealth);
router.post('/integrations/google/disconnect', requirePermission('integration:manage'), googleDisconnect);

router.get('/integrations/health', requirePermission('integration:view'), integrationsHealth);

router.get('/integrations/routing-rules', requirePermission('routing:view'), listRouting);
router.post('/integrations/routing-rules', requirePermission('routing:manage'), createRouting);

export default router;
