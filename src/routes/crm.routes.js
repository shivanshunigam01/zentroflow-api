import { Router } from 'express';
import { validate } from '../middleware/validate.middleware.js';
import { resolveTenantContext } from '../middleware/tenant.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import {
  crmDashboard,
  crmListLeads,
  crmGetLead,
  crmChangeStage,
  crmAssignLead,
  crmListCustomers,
  crmGetCustomer,
  crmListFollowups,
  crmCreateFollowup,
  crmUpdateFollowup,
  crmQualifyLead,
  crmDisqualifyLead,
  crmRecalculateScore,
  crmGetScoreHistory,
  crmListScoreRules,
  crmListScoreRulesAdmin,
  crmCreateScoreRule,
  crmUpdateScoreRule,
  crmGetScoreBands,
  crmGetDuplicates,
  crmKeepSeparate,
  crmLinkDuplicate,
  crmMergeDuplicate,
  crmCreateTestDrive,
  crmListTestDrives,
  crmUpdateTestDrive,
  crmCreateQuotation,
  crmListQuotations,
  crmUpdateQuotation,
  crmCreateBooking,
  crmListBookings,
  crmUpdateBooking,
  crmCreateRetail,
  crmListRetail,
  crmUpdateRetail,
} from '../controllers/crm/crm.controller.js';
import {
  listLeadsValidator,
  listCustomersValidator,
  listFollowupsValidator,
  leadIdParam,
  followupIdParam,
  customerIdParam,
  changeStageValidator,
  assignLeadValidator,
  createFollowupValidator,
  updateFollowupValidator,
  qualifyValidator,
  disqualifyValidator,
  dedupeActionValidator,
  mergeValidator,
  createScoreRuleValidator,
  updateScoreRuleValidator,
  scoreRuleIdParam,
} from '../validators/crm.validator.js';

const router = Router();

router.use(resolveTenantContext);

router.get('/dashboard', requirePermission('crm:dashboard:view'), crmDashboard);

router.get('/leads', requirePermission('lead:view'), listLeadsValidator, validate, crmListLeads);
router.get('/leads/:id', requirePermission('lead:view'), leadIdParam, validate, crmGetLead);
router.post('/leads/:id/stage', requirePermission('lead:stage'), changeStageValidator, validate, crmChangeStage);
router.post('/leads/:id/assign', requirePermission('lead:assign'), assignLeadValidator, validate, crmAssignLead);

router.post('/leads/:id/qualify', requirePermission('lead:qualify'), qualifyValidator, validate, crmQualifyLead);
router.post('/leads/:id/disqualify', requirePermission('lead:qualify'), disqualifyValidator, validate, crmDisqualifyLead);
router.post('/leads/:id/score/recalculate', requirePermission('lead:score'), leadIdParam, validate, crmRecalculateScore);
router.get('/leads/:id/score', requirePermission('lead:score'), leadIdParam, validate, crmGetScoreHistory);
router.get('/leads/:id/duplicates', requirePermission('lead:dedupe'), leadIdParam, validate, crmGetDuplicates);
router.post('/leads/:id/duplicates/keep-separate', requirePermission('lead:dedupe'), dedupeActionValidator, validate, crmKeepSeparate);
router.post('/leads/:id/duplicates/link', requirePermission('lead:dedupe'), mergeValidator, validate, crmLinkDuplicate);
router.post('/leads/:id/duplicates/merge', requirePermission('lead:dedupe'), mergeValidator, validate, crmMergeDuplicate);

router.post('/leads/:id/followups', requirePermission('followup:edit'), createFollowupValidator, validate, crmCreateFollowup);

router.get('/followups', requirePermission('followup:view'), listFollowupsValidator, validate, crmListFollowups);
router.patch('/followups/:id', requirePermission('followup:edit'), updateFollowupValidator, validate, crmUpdateFollowup);

router.get('/score-rules', requirePermission('lead:score'), crmListScoreRules);
router.get('/settings/score-rules', requirePermission('score_rule:admin'), crmListScoreRulesAdmin);
router.post('/settings/score-rules', requirePermission('score_rule:admin'), createScoreRuleValidator, validate, crmCreateScoreRule);
router.patch('/settings/score-rules/:id', requirePermission('score_rule:admin'), updateScoreRuleValidator, validate, crmUpdateScoreRule);
router.get('/settings/score-bands', requirePermission('lead:score'), crmGetScoreBands);

router.get('/customers', requirePermission('customer:view'), listCustomersValidator, validate, crmListCustomers);
router.get('/customers/:id', requirePermission('customer:view'), customerIdParam, validate, crmGetCustomer);

// Sales journey
router.post('/leads/:id/test-drive', requirePermission('journey:test_drive'), leadIdParam, validate, crmCreateTestDrive);
router.get('/test-drives', requirePermission('journey:view'), crmListTestDrives);
router.patch('/test-drives/:id', requirePermission('journey:test_drive'), crmUpdateTestDrive);
router.post('/leads/:id/quotation', requirePermission('journey:quotation'), leadIdParam, validate, crmCreateQuotation);
router.get('/quotations', requirePermission('journey:view'), crmListQuotations);
router.patch('/quotations/:id', requirePermission('journey:quotation'), crmUpdateQuotation);
router.post('/leads/:id/booking', requirePermission('journey:booking'), leadIdParam, validate, crmCreateBooking);
router.get('/bookings', requirePermission('journey:view'), crmListBookings);
router.patch('/bookings/:id', requirePermission('journey:booking'), crmUpdateBooking);
router.post('/leads/:id/retail', requirePermission('journey:retail'), leadIdParam, validate, crmCreateRetail);
router.get('/retail', requirePermission('journey:view'), crmListRetail);
router.patch('/retail/:id', requirePermission('journey:retail'), crmUpdateRetail);

export default router;
