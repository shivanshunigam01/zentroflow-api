import CommunicationLog from '../models/CommunicationLog.js';
import Opportunity from '../models/Opportunity.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';

const BOT_STEPS = [
  'Welcome Sent',
  'Product Asked',
  'Location Asked',
  'Timeline Asked',
  'Finance Asked',
  'Callback Asked',
];

export const getBotJourney = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findOne({ opportunity_id: req.params.opportunityId });
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');

  const logs = await CommunicationLog.find({
    opportunity_id: opportunity.opportunity_id,
    channel: 'whatsapp',
  }).sort({ created_at: -1 }).limit(50);

  const completed = Math.min(
    BOT_STEPS.length,
    Math.max(0, Math.floor((Number(String(opportunity.current_micro_stage).split('.')[1]) || 1) - 1)),
  );

  ok(res, {
    opportunity_id: opportunity.opportunity_id,
    steps: BOT_STEPS.map((label, index) => ({
      label,
      status: index < completed ? 'done' : 'pending',
    })),
    messages: logs,
  });
});

export const sendBotMessage = asyncHandler(async (req, res) => {
  const { opportunity_id, message, template } = req.body;
  const opportunity = await Opportunity.findOne({ opportunity_id });
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');

  const text = message || template || 'Hello from ZentroFlow WhatsApp bot';
  const log = await CommunicationLog.create({
    opportunity_id,
    customer_id: opportunity.customer_id,
    channel: 'whatsapp',
    direction: 'outbound',
    message: text,
    status: 'sent',
    sent_by: req.user?.email || 'System',
  });

  opportunity.last_activity_at = new Date();
  await opportunity.save();

  ok(res, { log, provider_status: 'queued' });
});

/** Lightweight “mind” assistant — stores prompt/response on communication log */
export const mindAssist = asyncHandler(async (req, res) => {
  const { opportunity_id, prompt } = req.body;
  if (!prompt?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'prompt is required', 'prompt');

  let opportunity = null;
  if (opportunity_id) {
    opportunity = await Opportunity.findOne({ opportunity_id });
    if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');
  }

  const reply = opportunity
    ? `For ${opportunity.opportunity_id} at ${opportunity.current_micro_stage}: next step is "${opportunity.next_action}". Owner: ${opportunity.current_owner}.`
    : 'ZentroFlow Mind: upload leads or select an opportunity for context-aware guidance.';

  if (opportunity) {
    await CommunicationLog.create({
      opportunity_id: opportunity.opportunity_id,
      customer_id: opportunity.customer_id,
      channel: 'mind',
      direction: 'inbound',
      message: prompt,
      status: 'received',
      sent_by: req.user?.email || 'System',
    });
    await CommunicationLog.create({
      opportunity_id: opportunity.opportunity_id,
      customer_id: opportunity.customer_id,
      channel: 'mind',
      direction: 'outbound',
      message: reply,
      status: 'sent',
      sent_by: 'zentroflow-mind',
    });
  }

  ok(res, { prompt, reply, opportunity_id: opportunity?.opportunity_id ?? null });
});
