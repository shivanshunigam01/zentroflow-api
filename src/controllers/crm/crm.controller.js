import { asyncHandler } from '../../middleware/asyncHandler.middleware.js';
import { ok } from '../../helpers/apiResponse.js';
import { getCrmDashboard } from '../../services/crm/crmDashboard.service.js';
import { listCrmLeads } from '../../services/crm/crmLeadList.service.js';
import { getCrmLead360 } from '../../services/crm/crmLead360.service.js';
import { listCrmCustomers, getCrmCustomer360 } from '../../services/crm/crmCustomer.service.js';
import { changeLeadStage } from '../../services/crm/crmStage.service.js';
import { assignLead } from '../../services/crm/crmAssign.service.js';
import { createFollowup, updateFollowup, listFollowups } from '../../services/crm/crmFollowup.service.js';
import { qualifyLead, disqualifyLead } from '../../services/crm/crmQualification.service.js';
import { recalculateLeadScore, getScoreHistory, listScoreRules } from '../../services/crm/crmScoring.service.js';
import {
  listScoreRulesAdmin,
  createScoreRule,
  updateScoreRule,
  getScoreBands,
} from '../../services/crm/crmScoreRulesAdmin.service.js';
import {
  findDuplicateCandidates,
  keepSeparate,
  linkDuplicate,
  mergeDuplicate,
} from '../../services/crm/crmDeduplication.service.js';
import { enrichLeadDto } from '../../helpers/leadDto.js';
import {
  createTestDrive, listTestDrives, updateTestDrive,
  createQuotation, listQuotations, updateQuotation,
  createBooking, listBookings, updateBooking,
  createRetail, listRetail, updateRetail,
} from '../../services/crm/crmSalesJourney.service.js';

const ctx = (req, res) => ({
  tenantContext: req.tenantContext,
  correlation_id: res.locals.correlationId,
  ip_address: req.ip,
});

export const crmDashboard = asyncHandler(async (req, res) => {
  ok(res, await getCrmDashboard(req.tenantContext));
});

export const crmListLeads = asyncHandler(async (req, res) => {
  const { items, meta } = await listCrmLeads(req.tenantContext, req.query);
  ok(res, items, meta);
});

export const crmGetLead = asyncHandler(async (req, res) => {
  ok(res, await getCrmLead360(req.tenantContext, req.params.id));
});

export const crmChangeStage = asyncHandler(async (req, res) => {
  const updated = await changeLeadStage({
    ...ctx(req, res),
    leadId: req.params.id,
    new_micro_stage: req.body.new_micro_stage,
    reason: req.body.reason,
    force: Boolean(req.body.force),
  });
  ok(res, await enrichLeadDto(updated));
});

export const crmAssignLead = asyncHandler(async (req, res) => {
  const updated = await assignLead({
    ...ctx(req, res),
    leadId: req.params.id,
    new_owner: req.body.new_owner,
    reason: req.body.reason,
  });
  ok(res, await enrichLeadDto(updated));
});

export const crmListCustomers = asyncHandler(async (req, res) => {
  const { items, meta } = await listCrmCustomers(req.tenantContext, req.query);
  ok(res, items, meta);
});

export const crmGetCustomer = asyncHandler(async (req, res) => {
  ok(res, await getCrmCustomer360(req.tenantContext, req.params.id));
});

export const crmListFollowups = asyncHandler(async (req, res) => {
  const { items, meta } = await listFollowups(req.tenantContext, req.query);
  ok(res, items, meta);
});

export const crmCreateFollowup = asyncHandler(async (req, res) => {
  const followup = await createFollowup({
    ...ctx(req, res),
    leadId: req.params.id,
    body: req.body,
  });
  ok(res, followup, { status: 201 });
});

export const crmUpdateFollowup = asyncHandler(async (req, res) => {
  const followup = await updateFollowup({
    ...ctx(req, res),
    followupId: req.params.id,
    body: req.body,
  });
  ok(res, followup);
});

export const crmQualifyLead = asyncHandler(async (req, res) => {
  const updated = await qualifyLead({
    ...ctx(req, res),
    leadId: req.params.id,
    notes: req.body.notes,
  });
  ok(res, await enrichLeadDto(updated));
});

export const crmDisqualifyLead = asyncHandler(async (req, res) => {
  const updated = await disqualifyLead({
    ...ctx(req, res),
    leadId: req.params.id,
    reason: req.body.reason,
  });
  ok(res, await enrichLeadDto(updated));
});

export const crmRecalculateScore = asyncHandler(async (req, res) => {
  const result = await recalculateLeadScore({
    ...ctx(req, res),
    leadId: req.params.id,
  });
  ok(res, {
    lead: await enrichLeadDto(result.opportunity),
    score_reasons: result.score_reasons,
    bands: result.bands,
  });
});

export const crmGetScoreHistory = asyncHandler(async (req, res) => {
  ok(res, await getScoreHistory(req.tenantContext, req.params.id));
});

export const crmListScoreRules = asyncHandler(async (req, res) => {
  ok(res, await listScoreRules(req.tenantContext));
});

export const crmListScoreRulesAdmin = asyncHandler(async (req, res) => {
  ok(res, await listScoreRulesAdmin(req.tenantContext));
});

export const crmCreateScoreRule = asyncHandler(async (req, res) => {
  const rule = await createScoreRule({
    ...ctx(req, res),
    body: req.body,
  });
  ok(res, rule, { status: 201 });
});

export const crmUpdateScoreRule = asyncHandler(async (req, res) => {
  const rule = await updateScoreRule({
    ...ctx(req, res),
    ruleId: req.params.id,
    body: req.body,
  });
  ok(res, rule);
});

export const crmGetScoreBands = asyncHandler(async (_req, res) => {
  ok(res, getScoreBands());
});

export const crmGetDuplicates = asyncHandler(async (req, res) => {
  ok(res, await findDuplicateCandidates(req.tenantContext, req.params.id));
});

export const crmKeepSeparate = asyncHandler(async (req, res) => {
  const updated = await keepSeparate({
    ...ctx(req, res),
    leadId: req.params.id,
    reason: req.body.reason,
  });
  ok(res, await enrichLeadDto(updated));
});

export const crmLinkDuplicate = asyncHandler(async (req, res) => {
  const result = await linkDuplicate({
    ...ctx(req, res),
    leadId: req.params.id,
    target_opportunity_id: req.body.target_opportunity_id,
    reason: req.body.reason,
  });
  ok(res, {
    source: await enrichLeadDto(result.source),
    target: await enrichLeadDto(result.target),
  });
});

export const crmMergeDuplicate = asyncHandler(async (req, res) => {
  const result = await mergeDuplicate({
    ...ctx(req, res),
    leadId: req.params.id,
    target_opportunity_id: req.body.target_opportunity_id,
    reason: req.body.reason,
  });
  ok(res, {
    merged: await enrichLeadDto(result.merged),
    primary: await enrichLeadDto(result.primary),
  });
});

export const crmCreateTestDrive = asyncHandler(async (req, res) => {
  ok(res, await createTestDrive({ ...ctx(req, res), leadId: req.params.id, body: req.body }), { status: 201 });
});
export const crmListTestDrives = asyncHandler(async (req, res) => {
  const { items, meta } = await listTestDrives(req.tenantContext, req.query);
  ok(res, items, meta);
});
export const crmUpdateTestDrive = asyncHandler(async (req, res) => {
  ok(res, await updateTestDrive({ ...ctx(req, res), id: req.params.id, body: req.body }));
});

export const crmCreateQuotation = asyncHandler(async (req, res) => {
  ok(res, await createQuotation({ ...ctx(req, res), leadId: req.params.id, body: req.body }), { status: 201 });
});
export const crmListQuotations = asyncHandler(async (req, res) => {
  const { items, meta } = await listQuotations(req.tenantContext, req.query);
  ok(res, items, meta);
});
export const crmUpdateQuotation = asyncHandler(async (req, res) => {
  ok(res, await updateQuotation({ ...ctx(req, res), id: req.params.id, body: req.body }));
});

export const crmCreateBooking = asyncHandler(async (req, res) => {
  ok(res, await createBooking({ ...ctx(req, res), leadId: req.params.id, body: req.body }), { status: 201 });
});
export const crmListBookings = asyncHandler(async (req, res) => {
  const { items, meta } = await listBookings(req.tenantContext, req.query);
  ok(res, items, meta);
});
export const crmUpdateBooking = asyncHandler(async (req, res) => {
  ok(res, await updateBooking({ ...ctx(req, res), id: req.params.id, body: req.body }));
});

export const crmCreateRetail = asyncHandler(async (req, res) => {
  ok(res, await createRetail({ ...ctx(req, res), leadId: req.params.id, body: req.body }), { status: 201 });
});
export const crmListRetail = asyncHandler(async (req, res) => {
  const { items, meta } = await listRetail(req.tenantContext, req.query);
  ok(res, items, meta);
});
export const crmUpdateRetail = asyncHandler(async (req, res) => {
  ok(res, await updateRetail({ ...ctx(req, res), id: req.params.id, body: req.body }));
});
