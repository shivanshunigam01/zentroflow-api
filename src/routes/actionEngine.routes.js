import { Router } from 'express';
import {
  actionContext,
  getEngineHealth,
  getRules,
  listActions,
  postAccept,
  postActivate,
  postComplete,
  postDomainEvent,
  postPause,
  postReassign,
  postRule,
  postShadow,
  postSimulate,
  postStart,
} from '../controllers/actionEngine.controller.js';

const router = Router();

router.post('/action-engine/events', postDomainEvent);
router.get('/action-engine/health', getEngineHealth);

router.get('/actions', listActions);
router.post('/actions/:id/accept', postAccept);
router.post('/actions/:id/start', postStart);
router.post('/actions/:id/complete', postComplete);
router.post('/actions/:id/reassign', postReassign);

router.get('/rules', getRules);
router.post('/rules', postRule);
router.post('/rules/:id/simulate', postSimulate);
router.post('/rules/:id/activate', postActivate);
router.post('/rules/:id/shadow', postShadow);
router.post('/rules/:id/pause', postPause);

// Mounted both here (flat) and under opportunities for REST clarity
router.get('/opportunities/:opportunityId/action-context', actionContext);

export default router;
