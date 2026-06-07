import Customer from '../models/Customer.js';
import { isValidMobile, normalizeMobile } from '../helpers/mobile.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';

const str = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

/**
 * When a stage step is saved, mirror known form fields onto Customer + Opportunity
 * so Lead Inbox / list views show updated name, mobile, product, score, etc.
 */
export const syncStageFieldsToLead = async (opportunity, fields = {}) => {
  if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
    return { opportunity, customer: null, updated: false };
  }

  const customer = await Customer.findOne({ customer_id: opportunity.customer_id });
  if (!customer) return { opportunity, customer: null, updated: false };

  let oppDirty = false;
  let custDirty = false;

  const name = str(fields.customer_name);
  if (name) {
    customer.name = name;
    custDirty = true;
  }

  const mobileRaw = str(fields.customer_mobile);
  if (mobileRaw) {
    if (!isValidMobile(mobileRaw)) {
      throw new ApiError(400, 'INVALID_MOBILE', 'Valid Indian mobile number is required', 'customer_mobile');
    }
    const mobile_normalized = normalizeMobile(mobileRaw);
    const duplicate = await Customer.findOne({
      mobile_normalized,
      customer_id: { $ne: customer.customer_id },
    });
    if (duplicate) {
      throw new ApiError(409, 'DUPLICATE_CUSTOMER', 'Another customer already uses this mobile', 'customer_mobile');
    }
    customer.mobile = mobileRaw;
    customer.mobile_normalized = mobile_normalized;
    custDirty = true;
  }

  if (fields.customer_email !== undefined) {
    customer.email = str(fields.customer_email) || undefined;
    custDirty = true;
  }

  const address = str(fields.customer_address) || str(fields.location);
  if (address) {
    customer.address = address;
    custDirty = true;
  }

  const product = str(fields.product) || str(fields.product_required);
  if (product) {
    opportunity.product = product;
    oppDirty = true;
  }

  const source = str(fields.source);
  if (source) {
    opportunity.source = source;
    oppDirty = true;
  }

  if (fields.campaign !== undefined) {
    opportunity.campaign = str(fields.campaign) || undefined;
    oppDirty = true;
  }

  const branch = str(fields.territory) || str(fields.branch);
  if (branch) {
    opportunity.branch = branch;
    oppDirty = true;
  }

  const variant = str(fields.variant) || str(fields.variant_locked);
  if (variant) {
    opportunity.variant = variant;
    oppDirty = true;
  }

  const priority = str(fields.call_priority) || str(fields.priority);
  if (priority && /^P[1-5]$/.test(priority)) {
    opportunity.priority = priority;
    oppDirty = true;
  }

  const scoreRaw = str(fields.calculated_score);
  if (scoreRaw && !Number.isNaN(Number(scoreRaw))) {
    opportunity.lead_score = Number(scoreRaw);
    oppDirty = true;
  }

  const scoreBand = str(fields.score_output);
  if (['Cold', 'Warm', 'Hot', 'Critical'].includes(scoreBand)) {
    opportunity.score_classification = scoreBand;
    oppDirty = true;
  }

  const requirement = str(fields.pain_point) || str(fields.requirement);
  if (requirement) {
    opportunity.requirement = requirement;
    oppDirty = true;
  }

  const owner = str(fields.assigned_owner);
  if (owner) {
    opportunity.current_owner = owner;
    oppDirty = true;
  }

  if (custDirty) await customer.save();
  if (oppDirty) {
    opportunity.last_activity_at = new Date();
    await opportunity.save();
  }

  return {
    opportunity,
    customer,
    updated: custDirty || oppDirty,
  };
};
