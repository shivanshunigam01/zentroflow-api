import Customer from '../models/Customer.js';
import Opportunity from '../models/Opportunity.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { normalizeMobile, isValidMobile } from '../helpers/mobile.js';
import { moveStage } from './stageTransition.service.js';
import { enrichLeadDto } from '../helpers/leadDto.js';

const pickDefined = (body, keys) => {
  const out = {};
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      out[key] = body[key];
    }
  }
  return out;
};

export const manualLeadEdit = async (opportunityId, body = {}, changedBy = 'System') => {
  let opportunity = await Opportunity.findOne({ opportunity_id: opportunityId });
  if (!opportunity) throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND', 'Opportunity not found');

  const newMicro = body.new_micro_stage?.trim();
  if (newMicro && newMicro !== opportunity.current_micro_stage) {
    opportunity = await moveStage({
      opportunity_id: opportunityId,
      new_micro_stage: newMicro,
      changed_by: changedBy,
      reason: body.stage_reason?.trim() || 'Manual edit from lead detail form',
      force: true,
    });
  }

  const patch = pickDefined(body, [
    'product',
    'variant',
    'requirement',
    'current_owner',
    'current_action',
    'next_action',
    'priority',
    'lead_score',
    'score_classification',
    'sla',
    'sla_status',
    'escalation_owner',
    'status',
    'source',
    'campaign',
    'branch',
  ]);

  if (body.next_action_date) patch.next_action_date = new Date(body.next_action_date);
  if (body.sla_due_at) patch.sla_due_at = new Date(body.sla_due_at);
  if (typeof body.lead_score === 'number') patch.lead_score = body.lead_score;

  if (Object.keys(patch).length > 0) {
    Object.assign(opportunity, patch);
    opportunity.last_activity_at = new Date();
    await opportunity.save();
  }

  const customer = await Customer.findOne({ customer_id: opportunity.customer_id });
  if (customer) {
    let customerDirty = false;

    if (body.customer_name?.trim()) {
      customer.name = body.customer_name.trim();
      customerDirty = true;
    }
    if (body.customer_email !== undefined) {
      customer.email = String(body.customer_email).trim() || undefined;
      customerDirty = true;
    }
    if (body.customer_address !== undefined) {
      customer.address = String(body.customer_address).trim() || undefined;
      customerDirty = true;
    }

    if (body.customer_mobile?.trim()) {
      if (!isValidMobile(body.customer_mobile)) {
        throw new ApiError(400, 'INVALID_MOBILE', 'Valid Indian mobile number is required', 'customer_mobile');
      }
      const mobile_normalized = normalizeMobile(body.customer_mobile);
      const duplicate = await Customer.findOne({
        mobile_normalized,
        customer_id: { $ne: customer.customer_id },
      });
      if (duplicate) {
        throw new ApiError(409, 'DUPLICATE_CUSTOMER', 'Another customer already uses this mobile', 'customer_mobile');
      }
      customer.mobile = body.customer_mobile.trim();
      customer.mobile_normalized = mobile_normalized;
      customerDirty = true;
    }

    if (customerDirty) await customer.save();
  }

  const refreshed = await Opportunity.findOne({ opportunity_id: opportunityId });
  return enrichLeadDto(refreshed);
};
