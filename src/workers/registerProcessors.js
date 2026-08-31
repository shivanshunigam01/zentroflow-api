/**
 * Register queue job processors for CRM production pipeline.
 */
import { registerProcessor } from '../services/queue/queue.service.js';
import { processLeadIngestionEvent } from '../services/integrations/leadProcessor.service.js';
import { processConversionEvent } from '../services/integrations/conversionEvent.service.js';

export const registerQueueProcessors = () => {
  registerProcessor('lead.ingestion.process', async (job) => {
    const { event_id } = job.payload || {};
    if (!event_id) throw new Error('Missing event_id in job payload');
    await processLeadIngestionEvent(event_id);
  });

  registerProcessor('conversion.send', async (job) => {
    const { conversion_id } = job.payload || {};
    if (!conversion_id) throw new Error('Missing conversion_id in job payload');
    await processConversionEvent(conversion_id);
  });

  registerProcessor('noop', async () => {});
};
