import Opportunity from '../../models/Opportunity.js';
import Customer from '../../models/Customer.js';
import LeadActivity from '../../models/LeadActivity.js';
import StageHistory from '../../models/StageHistory.js';
import CommunicationLog from '../../models/CommunicationLog.js';
import AssignmentHistory from '../../models/crm/AssignmentHistory.js';
import Followup from '../../models/crm/Followup.js';
import ScoreLedger from '../../models/ScoreLedger.js';
import { assertTenantAccess } from '../../middleware/tenant.middleware.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { enrichLeadDto } from '../../helpers/leadDto.js';
import { findDuplicateCandidates } from './crmDeduplication.service.js';
import { getLeadAttribution } from './crmAttribution.service.js';
import { SCORE_BANDS } from '../../constants/crmScoreRules.js';

export const getCrmLead360 = async (tenantContext, leadId) => {
  const opportunity = await Opportunity.findOne({
    $or: [{ opportunity_id: leadId }, { lead_id: leadId }],
  }).lean();

  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  const [customer, activities, stageHistory, communications, assignmentHistory, followups, scoreLedger, lead, duplicates, attribution] = await Promise.all([
    Customer.findOne({ customer_id: opportunity.customer_id }).lean(),
    LeadActivity.find({ opportunity_id: opportunity.opportunity_id }).sort({ created_at: -1 }).limit(100).lean(),
    StageHistory.find({ opportunity_id: opportunity.opportunity_id }).sort({ created_at: 1 }).lean(),
    CommunicationLog.find({ opportunity_id: opportunity.opportunity_id }).sort({ created_at: -1 }).limit(50).lean(),
    AssignmentHistory.find({ opportunity_id: opportunity.opportunity_id }).sort({ created_at: -1 }).limit(50).lean(),
    Followup.find({ opportunity_id: opportunity.opportunity_id }).sort({ scheduled_at: -1 }).limit(50).lean(),
    ScoreLedger.find({ opportunity_id: opportunity.opportunity_id }).sort({ created_at: -1 }).limit(30).lean(),
    enrichLeadDto(opportunity),
    findDuplicateCandidates(tenantContext, opportunity.opportunity_id).catch(() => null),
    getLeadAttribution(tenantContext, opportunity.opportunity_id).catch(() => null),
  ]);

  return {
    lead,
    customer,
    stage_history: stageHistory,
    activities,
    communications,
    assignment_history: assignmentHistory,
    followups,
    scoring: {
      lead_score: opportunity.lead_score,
      score_classification: opportunity.score_classification,
      temperature: opportunity.temperature,
      score_reasons: opportunity.score_reasons || [],
      score_version: opportunity.score_version || 1,
      bands: SCORE_BANDS,
      ledger: scoreLedger,
    },
    duplicates,
    attribution,
  };
};
