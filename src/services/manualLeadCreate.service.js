import Customer from '../models/Customer.js';
import Opportunity from '../models/Opportunity.js';
import { normalizeMobile, isValidMobile } from '../helpers/mobile.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import { enrichLeadDto } from '../helpers/leadDto.js';
import { generateIds } from '../services/idGeneration.service.js';
import { classifyDuplicate } from '../services/duplicate.service.js';

/**
 * Create a single ZentroFLOW lead (Customer + Opportunity) from the frontend form.
 * Mirrors Excel import defaults — starts at C0.1 via Opportunity schema defaults.
 */
export const createManualLead = async (body = {}, createdBy = 'System') => {
  const mobileRaw = body.mobile ?? body.customer_mobile;
  if (!isValidMobile(mobileRaw)) {
    throw new ApiError(400, 'INVALID_MOBILE', 'Valid Indian mobile number is required', 'mobile');
  }

  const mobile_normalized = normalizeMobile(mobileRaw);
  const mobile = String(mobileRaw).trim();
  const customerName = String(body.customerName ?? body.customer_name ?? '').trim() || `Lead ${mobile_normalized}`;
  const product = String(body.product ?? '').trim() || 'General';
  const requirement = String(body.requirement ?? '').trim() || undefined;
  const address = String(body.district ?? body.address ?? body.customer_address ?? '').trim() || undefined;
  const source = String(body.source ?? '').trim() || 'Manual Entry';
  const branch = String(body.branch ?? '').trim() || 'Default Branch';
  const currentOwner = String(body.executive ?? body.current_owner ?? createdBy ?? '').trim() || 'Sales Executive';

  let customer = await Customer.findOne({ mobile_normalized });
  if (!customer) {
    const ids = generateIds(customerName);
    customer = await Customer.create({
      customer_id: ids.customer_id,
      name: customerName,
      mobile,
      mobile_normalized,
      email: body.email ?? body.customer_email ?? undefined,
      address,
      customer_type: body.customer_type || 'Individual',
    });
  } else if (customerName && customer.name !== customerName) {
    customer.name = customerName;
    if (address) customer.address = address;
    if (body.email ?? body.customer_email) customer.email = body.email ?? body.customer_email;
    await customer.save();
  }

  const duplicate = await classifyDuplicate({
    customer_id: customer.customer_id,
    product,
    requirement: requirement ?? null,
  });
  if (duplicate.duplicate) {
    throw new ApiError(
      409,
      'DUPLICATE_LEAD',
      'An active lead with the same product and requirement already exists for this mobile',
      'product',
    );
  }

  const ids = generateIds(customerName);
  const opportunity = await Opportunity.create({
    opportunity_id: ids.opportunity_id,
    lead_id: ids.lead_id,
    customer_id: customer.customer_id,
    product,
    variant: body.variant ?? undefined,
    requirement,
    opportunity_type: body.opportunity_type || 'New',
    current_owner: currentOwner,
    source,
    campaign: body.campaign ?? undefined,
    branch,
    escalation_owner: body.escalation_owner || 'Sales Manager',
  });

  console.log(JSON.stringify({
    service: 'leads',
    operation: 'createManualLead',
    opportunity_id: opportunity.opportunity_id,
    customer_id: customer.customer_id,
    created_by: createdBy,
    status: 'success',
  }));

  return enrichLeadDto(opportunity);
};
