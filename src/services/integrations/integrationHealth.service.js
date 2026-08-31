import PlatformConnection from '../../models/integrations/PlatformConnection.js';
import LeadIngestionEvent from '../../models/integrations/LeadIngestionEvent.js';
import ConversionEvent from '../../models/integrations/ConversionEvent.js';
import MetaFormMapping from '../../models/integrations/MetaFormMapping.js';
import JobQueue from '../../models/JobQueue.js';
import { getAdapter } from '../../integrations/platformAdapter.js';
import { buildTenantFilter } from '../../helpers/tenantScope.js';
import '../../integrations/meta/metaAdapter.js';
import '../../integrations/google/googleAdapter.js';

export const getIntegrationHealth = async (tenantContext) => {
  const tenantFilter = buildTenantFilter(tenantContext);
  const [metaHealth, googleHealth, unmappedForms, failedIngestion, failedConversions, queuePending] = await Promise.all([
    getAdapter('meta').healthCheck({ tenantContext }),
    getAdapter('google').healthCheck({ tenantContext }),
    MetaFormMapping.countDocuments({ ...tenantFilter, status: 'UNMAPPED' }),
    LeadIngestionEvent.countDocuments({ ...tenantFilter, processing_status: 'FAILED' }),
    ConversionEvent.countDocuments({ ...tenantFilter, status: { $in: ['FAILED', 'DEAD_LETTER'] } }),
    JobQueue.countDocuments({ status: 'PENDING' }),
  ]);

  const lastLead = await LeadIngestionEvent.findOne({ ...tenantFilter, processing_status: 'COMPLETED' })
    .sort({ processed_at: -1 }).lean();

  const sentConversions = await ConversionEvent.countDocuments({ ...tenantFilter, status: 'SENT' });

  return {
    meta: {
      ...metaHealth,
      webhook_status: 'healthy',
      last_lead_at: lastLead?.processed_at || null,
      unmapped_forms: unmappedForms,
      failed_ingestion: failedIngestion,
    },
    google: googleHealth,
    conversions: { successful: sentConversions, failed: failedConversions },
    queue: { pending: queuePending },
    last_successful_sync: lastLead?.processed_at || null,
  };
};

export const getMetaIntegrationHealth = async (tenantContext) => {
  const health = await getIntegrationHealth(tenantContext);
  return health.meta;
};

export const getGoogleIntegrationHealth = async (tenantContext) => {
  const health = await getIntegrationHealth(tenantContext);
  return health.google;
};

export const listPlatformConnections = async (tenantContext) =>
  PlatformConnection.find(buildTenantFilter(tenantContext)).sort({ updated_at: -1 }).lean();
