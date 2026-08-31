import Opportunity from '../../models/Opportunity.js';
import TestDrive from '../../models/crm/TestDrive.js';
import Booking from '../../models/crm/Booking.js';
import Retail from '../../models/crm/Retail.js';
import LeadIngestionEvent from '../../models/integrations/LeadIngestionEvent.js';
import ConversionEvent from '../../models/integrations/ConversionEvent.js';
import { buildTenantFilter } from '../../helpers/tenantScope.js';

export const getCrmDashboard = async (tenantContext) => {
  const base = buildTenantFilter(tenantContext);
  const now = new Date();
  const [
    totalLeads, newLeads, activeLeads, qualifiedLeads, hotLeads, warmLeads, coldLeads,
    lostLeads, deliveredLeads, followupsDue, unassignedLeads, duplicateLeads,
    metaLeads, googleLeads, organicLeads, testDrives, bookings, retailCount,
    failedIngestion, failedConversions,
  ] = await Promise.all([
    Opportunity.countDocuments(base),
    Opportunity.countDocuments({ ...base, current_micro_stage: { $regex: /^C0\./ } }),
    Opportunity.countDocuments({ ...base, status: { $in: ['Open', 'Hold'] } }),
    Opportunity.countDocuments({ ...base, qualification_status: 'QUALIFIED' }),
    Opportunity.countDocuments({ ...base, score_classification: 'Hot' }),
    Opportunity.countDocuments({ ...base, score_classification: 'Warm' }),
    Opportunity.countDocuments({ ...base, score_classification: 'Cold' }),
    Opportunity.countDocuments({ ...base, status: 'Lost' }),
    Opportunity.countDocuments({ ...base, status: 'Delivered' }),
    Opportunity.countDocuments({ ...base, status: { $in: ['Open', 'Hold'] }, next_action_date: { $lte: now } }),
    Opportunity.countDocuments({ ...base, status: { $in: ['Open', 'Hold'] }, current_owner: { $in: [null, '', 'Unassigned', 'Sales Executive'] } }),
    Opportunity.countDocuments({ ...base, duplicate_status: { $in: ['LIKELY_DUPLICATE', 'CONFIRMED_DUPLICATE'] } }),
    Opportunity.countDocuments({ ...base, source: /meta/i }),
    Opportunity.countDocuments({ ...base, source: /google/i }),
    Opportunity.countDocuments({ ...base, source: { $nin: [/meta/i, /google/i] } }),
    TestDrive.countDocuments(buildTenantFilter(tenantContext)),
    Booking.countDocuments(buildTenantFilter(tenantContext)),
    Retail.countDocuments(buildTenantFilter(tenantContext)),
    LeadIngestionEvent.countDocuments({ ...buildTenantFilter(tenantContext), processing_status: 'FAILED' }),
    ConversionEvent.countDocuments({ ...buildTenantFilter(tenantContext), status: { $in: ['FAILED', 'DEAD_LETTER'] } }),
  ]);

  return {
    total_leads: totalLeads,
    new_leads: newLeads,
    active_leads: activeLeads,
    qualified_leads: qualifiedLeads,
    hot_leads: hotLeads,
    warm_leads: warmLeads,
    cold_leads: coldLeads,
    lost_leads: lostLeads,
    retail_delivered: deliveredLeads,
    followups_due: followupsDue,
    unassigned_leads: unassignedLeads,
    duplicate_leads: duplicateLeads,
    marketing: { meta_leads: metaLeads, google_leads: googleLeads, organic_leads: organicLeads },
    sales_journey: { test_drives: testDrives, bookings, retail: retailCount },
    operational: { failed_integrations: failedIngestion, failed_conversion_events: failedConversions },
  };
};
