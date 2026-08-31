import { randomUUID } from 'crypto';
import Opportunity from '../../models/Opportunity.js';
import Customer from '../../models/Customer.js';
import LeadActivity from '../../models/LeadActivity.js';
import { buildTenantFilter } from '../../helpers/tenantScope.js';
import { assertTenantAccess } from '../../middleware/tenant.middleware.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { env } from '../../config/env.js';
import { writeAuditLog } from '../audit.service.js';
import { enrichLeadDto } from '../../helpers/leadDto.js';

const ACTIVE_STATUSES = ['Open', 'Hold'];
const normalize = (v) => String(v ?? '').trim().toLowerCase();
const normalizeEmail = (v) => normalize(v);

const resolveLead = async (leadId) =>
  Opportunity.findOne({ $or: [{ opportunity_id: leadId }, { lead_id: leadId }] });

const classifyCandidate = (source, candidate, customer, sourceCustomer) => {
  const signals = [];
  let classification = 'AMBIGUOUS';
  let requires_review = true;
  let confidence = 'low';

  if (customer?.mobile_normalized && sourceCustomer?.mobile_normalized &&
    customer.mobile_normalized === sourceCustomer.mobile_normalized) {
    signals.push('mobile');
  }

  const sourceEmail = normalizeEmail(sourceCustomer?.email);
  const candidateEmail = normalizeEmail(customer?.email);
  if (sourceEmail && candidateEmail && sourceEmail === candidateEmail) {
    signals.push('email');
  }

  if (
    source.external_lead_id &&
    candidate.external_lead_id &&
    source.external_lead_id === candidate.external_lead_id &&
    normalize(source.source) === normalize(candidate.source)
  ) {
    signals.push('external_lead_id');
  }

  const sameProductReq =
    normalize(candidate.product) === normalize(source.product) &&
    normalize(candidate.requirement) === normalize(source.requirement);

  if (signals.includes('external_lead_id') || (signals.includes('mobile') && sameProductReq)) {
    classification = 'LIKELY_DUPLICATE';
    requires_review = false;
    confidence = 'high';
  } else if (signals.includes('mobile') || signals.includes('email')) {
    classification = sameProductReq ? 'LIKELY_DUPLICATE' : 'EXISTING_CUSTOMER_NEW_LEAD';
    requires_review = !sameProductReq;
    confidence = sameProductReq ? 'high' : 'medium';
  } else if (candidate.customer_id === source.customer_id) {
    classification = sameProductReq ? 'LIKELY_DUPLICATE' : 'EXISTING_CUSTOMER_NEW_LEAD';
    requires_review = !sameProductReq;
    confidence = 'medium';
  }

  return { classification, signals, requires_review, confidence };
};

export const findDuplicateCandidates = async (tenantContext, leadId) => {
  const opportunity = await resolveLead(leadId);
  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  const customer = await Customer.findOne({ customer_id: opportunity.customer_id }).lean();
  const since = new Date(Date.now() - env.DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const tenantFilter = buildTenantFilter(tenantContext);
  const map = new Map();

  const addRows = (rows) => {
    for (const row of rows) {
      if (row.opportunity_id !== opportunity.opportunity_id) {
        map.set(row.opportunity_id, row);
      }
    }
  };

  addRows(await Opportunity.find({
    ...tenantFilter,
    customer_id: opportunity.customer_id,
    status: { $in: ACTIVE_STATUSES },
    last_activity_at: { $gte: since },
  }).sort({ created_at: -1 }).limit(20).lean());

  if (customer?.mobile_normalized) {
    const customers = await Customer.find({
      ...tenantFilter,
      mobile_normalized: customer.mobile_normalized,
      customer_id: { $ne: opportunity.customer_id },
    }).limit(20).lean();
    const customerIds = customers.map((c) => c.customer_id);
    if (customerIds.length) {
      addRows(await Opportunity.find({
        ...tenantFilter,
        customer_id: { $in: customerIds },
        status: { $in: ACTIVE_STATUSES },
        last_activity_at: { $gte: since },
      }).sort({ created_at: -1 }).limit(20).lean());
    }
  }

  if (customer?.email) {
    const emailNorm = normalizeEmail(customer.email);
    const customers = await Customer.find({
      ...tenantFilter,
      email: emailNorm,
      customer_id: { $ne: opportunity.customer_id },
    }).limit(20).lean();
    const customerIds = customers.map((c) => c.customer_id);
    if (customerIds.length) {
      addRows(await Opportunity.find({
        ...tenantFilter,
        customer_id: { $in: customerIds },
        status: { $in: ACTIVE_STATUSES },
        last_activity_at: { $gte: since },
      }).sort({ created_at: -1 }).limit(20).lean());
    }
  }

  if (opportunity.external_lead_id && opportunity.source) {
    addRows(await Opportunity.find({
      ...tenantFilter,
      external_lead_id: opportunity.external_lead_id,
      source: opportunity.source,
      opportunity_id: { $ne: opportunity.opportunity_id },
      status: { $in: ACTIVE_STATUSES },
      last_activity_at: { $gte: since },
    }).sort({ created_at: -1 }).limit(10).lean());
  }

  const candidates = await Promise.all(
    [...map.values()].map(async (row) => {
      const dto = await enrichLeadDto(row);
      const rowCustomer = await Customer.findOne({ customer_id: row.customer_id }).lean();
      const meta = classifyCandidate(opportunity, row, rowCustomer, customer);
      return {
        ...dto,
        duplicate_classification: meta.classification,
        match_signals: meta.signals,
        requires_review: meta.requires_review,
        match_confidence: meta.confidence,
      };
    }),
  );

  candidates.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.match_confidence] ?? 2) - (order[b.match_confidence] ?? 2);
  });

  return {
    lead_id: opportunity.lead_id,
    opportunity_id: opportunity.opportunity_id,
    duplicate_status: opportunity.duplicate_status,
    duplicate_group: opportunity.duplicate_group,
    window_days: env.DUPLICATE_WINDOW_DAYS,
    auto_merge_disabled: true,
    candidates,
  };
};

export const keepSeparate = async ({
  tenantContext,
  leadId,
  reason,
  correlation_id,
  ip_address,
}) => {
  const opportunity = await resolveLead(leadId);
  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  const before = { duplicate_status: opportunity.duplicate_status, duplicate_group: opportunity.duplicate_group };
  opportunity.duplicate_status = 'NEW';
  opportunity.duplicate_group = null;
  opportunity.linked_opportunity_id = null;
  await opportunity.save();

  await LeadActivity.create({
    opportunity_id: opportunity.opportunity_id,
    customer_id: opportunity.customer_id,
    type: 'duplicate.keep_separate',
    title: 'Marked as separate lead',
    description: reason || 'User confirmed not a duplicate',
    changed_by: tenantContext.user_name || tenantContext.user_email,
  });

  await writeAuditLog({
    tenantContext,
    action: 'duplicate.keep_separate',
    entity_type: 'opportunity',
    entity_id: opportunity.opportunity_id,
    before,
    after: { duplicate_status: 'NEW', duplicate_group: null },
    correlation_id,
    ip_address,
  });

  return opportunity;
};

export const linkDuplicate = async ({
  tenantContext,
  leadId,
  target_opportunity_id,
  reason,
  correlation_id,
  ip_address,
}) => {
  const opportunity = await resolveLead(leadId);
  const target = await Opportunity.findOne({ opportunity_id: target_opportunity_id });
  if (!opportunity || !target || !assertTenantAccess(opportunity, tenantContext) || !assertTenantAccess(target, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead or target not found');
  }

  const groupId = opportunity.duplicate_group || target.duplicate_group || randomUUID();
  const before = {
    duplicate_status: opportunity.duplicate_status,
    linked_opportunity_id: opportunity.linked_opportunity_id,
  };

  opportunity.duplicate_group = groupId;
  opportunity.duplicate_status = 'LIKELY_DUPLICATE';
  opportunity.linked_opportunity_id = target.opportunity_id;
  target.duplicate_group = groupId;
  if (!target.duplicate_status || target.duplicate_status === 'NEW') {
    target.duplicate_status = 'LIKELY_DUPLICATE';
  }

  await opportunity.save();
  await target.save();

  await LeadActivity.create({
    opportunity_id: opportunity.opportunity_id,
    customer_id: opportunity.customer_id,
    type: 'duplicate.linked',
    title: 'Linked to related lead',
    description: `Linked to ${target.lead_id}. ${reason || ''}`,
    changed_by: tenantContext.user_name || tenantContext.user_email,
  });

  await writeAuditLog({
    tenantContext,
    action: 'duplicate.linked',
    entity_type: 'opportunity',
    entity_id: opportunity.opportunity_id,
    before,
    after: { linked_opportunity_id: target.opportunity_id, duplicate_group: groupId },
    correlation_id,
    ip_address,
  });

  return { source: opportunity, target };
};

export const mergeDuplicate = async ({
  tenantContext,
  leadId,
  target_opportunity_id,
  reason,
  correlation_id,
  ip_address,
}) => {
  const opportunity = await resolveLead(leadId);
  const target = await Opportunity.findOne({ opportunity_id: target_opportunity_id });
  if (!opportunity || !target || !assertTenantAccess(opportunity, tenantContext) || !assertTenantAccess(target, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead or target not found');
  }

  if (opportunity.opportunity_id === target.opportunity_id) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Cannot merge lead with itself');
  }

  const groupId = target.duplicate_group || randomUUID();
  const before = {
    status: opportunity.status,
    duplicate_status: opportunity.duplicate_status,
    linked_opportunity_id: opportunity.linked_opportunity_id,
  };

  opportunity.duplicate_status = 'CONFIRMED_DUPLICATE';
  opportunity.duplicate_group = groupId;
  opportunity.linked_opportunity_id = target.opportunity_id;
  opportunity.status = 'Closed';
  await opportunity.save();

  target.duplicate_group = groupId;
  await target.save();

  await LeadActivity.create({
    opportunity_id: target.opportunity_id,
    customer_id: target.customer_id,
    type: 'duplicate.merged',
    title: 'Duplicate lead merged',
    description: `Merged ${opportunity.lead_id} into ${target.lead_id}. ${reason || ''}`,
    changed_by: tenantContext.user_name || tenantContext.user_email,
    payload: { merged_opportunity_id: opportunity.opportunity_id },
  });

  await writeAuditLog({
    tenantContext,
    action: 'duplicate.merged',
    entity_type: 'opportunity',
    entity_id: opportunity.opportunity_id,
    before,
    after: { merged_into: target.opportunity_id, duplicate_group: groupId, status: 'Closed' },
    correlation_id,
    ip_address,
  });

  return { merged: opportunity, primary: target };
};
