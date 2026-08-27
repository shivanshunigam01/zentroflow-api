import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  bulkSyncValidator,
  campaignPatchValidator,
  dispositionValidator,
  callsQueryValidator,
  syncJobIdValidator,
  syncLeadBodyOptionalValidator,
  syncLeadIdValidator,
  syncLeadsBodyValidator,
  testSyncValidator,
} from '../validators/dialer.validator.js';
import {
  bulkSyncDialerLeads,
  createDialerLead,
  dialerHealth,
  endSession,
  getConfiguredLeadList,
  getDialerCall,
  getDialerCampaign,
  getDialerCampaignStatus,
  getDialerCurrentCall,
  getDialerLeadSyncStatsHandler,
  getDialerStatisticsHandler,
  getDialerSyncJob,
  listConfiguredLeadListLeads,
  listDialerCallbacks,
  listDialerCalls,
  listDialerDispositions,
  listDialerLeadLists,
  listDialerLeads,
  listDialerRemoteLeads,
  logoutSession,
  patchDialerCampaign,
  postCallDisposition,
  postDialerDisposition,
  sessionStatus,
  startSession,
  syncAllDialerLeadsHandler,
  syncDialerLead,
  syncPendingDialerLeads,
  testLeadStatus,
  testSyncLead,
} from '../controllers/dialer.controller.js';

const router = Router();

router.get('/health', dialerHealth);
router.get('/campaign', getDialerCampaign);
router.get('/campaign/status', getDialerCampaignStatus);
router.patch('/campaign', requireAdmin, campaignPatchValidator, validate, patchDialerCampaign);

router.get('/statistics', getDialerStatisticsHandler);
router.get('/current-call', getDialerCurrentCall);

router.get('/lead-list', requireAdmin, getConfiguredLeadList);
router.get('/lead-list/leads', requireAdmin, listConfiguredLeadListLeads);
router.get('/lead-lists', requireAdmin, listDialerLeadLists);
router.get('/lead-lists/:listId/leads', requireAdmin, listDialerRemoteLeads);

router.get('/leads', listDialerLeads);
router.get('/leads/sync/stats', requireAdmin, getDialerLeadSyncStatsHandler);
router.post('/leads', requireAdmin, createDialerLead);
router.post('/leads/bulk', requireAdmin, bulkSyncValidator, validate, bulkSyncDialerLeads);
router.post('/leads/sync', requireAdmin, syncLeadsBodyValidator, validate, syncPendingDialerLeads);
router.post('/leads/sync-all', requireAdmin, syncAllDialerLeadsHandler);
router.post('/leads/:id/sync', syncLeadIdValidator, syncLeadBodyOptionalValidator, validate, syncDialerLead);

router.get('/sync-jobs/:syncId', requireAdmin, syncJobIdValidator, validate, getDialerSyncJob);

router.get('/dispositions', listDialerDispositions);
router.post('/disposition', dispositionValidator, validate, postDialerDisposition);

router.get('/calls', callsQueryValidator, validate, listDialerCalls);
router.get('/calls/:id', getDialerCall);
router.post('/calls/:id/disposition', dispositionValidator, validate, postCallDisposition);
router.get('/callbacks', listDialerCallbacks);

router.post('/session/start', startSession);
router.post('/session/end', endSession);
router.post('/session/logout', logoutSession);
router.get('/session/status', sessionStatus);

router.post('/test/sync-lead', requireAdmin, testSyncValidator, validate, testSyncLead);
router.get('/test/lead/:leadId', requireAdmin, testLeadStatus);

export default router;
