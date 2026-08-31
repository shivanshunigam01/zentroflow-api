import { randomUUID } from 'crypto';
import Followup from '../../models/crm/Followup.js';
import Opportunity from '../../models/Opportunity.js';
import LeadActivity from '../../models/LeadActivity.js';
import { buildTenantFilter } from '../../helpers/tenantScope.js';
import { assertTenantAccess } from '../../middleware/tenant.middleware.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { getPagination, paginationMeta } from '../../helpers/pagination.js';
import { writeAuditLog } from '../audit.service.js';
import { publishEvent } from '../event.service.js';

const resolveLead = async (leadId) => {
  const opp = await Opportunity.findOne({
    $or: [{ opportunity_id: leadId }, { lead_id: leadId }],
  });
  return opp;
};

export const createFollowup = async ({
  tenantContext,
  leadId,
  body,
  correlation_id,
  ip_address,
}) => {
  const opportunity = await resolveLead(leadId);
  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }

  const scheduledAt = new Date(body.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'scheduled_at must be a valid date', 'scheduled_at');
  }

  const now = new Date();
  const status = scheduledAt <= now ? 'DUE' : 'OPEN';

  const followup = await Followup.create({
    followup_id: randomUUID(),
    opportunity_id: opportunity.opportunity_id,
    lead_id: opportunity.lead_id,
    tenant_id: tenantContext.tenant_id,
    organization_id: tenantContext.organization_id,
    dealer_id: tenantContext.dealer_id,
    branch_id: tenantContext.branch_id,
    assigned_to: body.assigned_to?.trim() || opportunity.current_owner,
    followup_type: body.followup_type || 'CALL',
    scheduled_at: scheduledAt,
    reminder_at: body.reminder_at ? new Date(body.reminder_at) : null,
    priority: body.priority || 'MEDIUM',
    status,
    remarks: body.remarks || null,
    created_by: tenantContext.user_email || tenantContext.user_id,
  });

  opportunity.next_action = `${body.followup_type || 'CALL'} follow-up`;
  opportunity.next_action_date = scheduledAt;
  opportunity.last_activity_at = now;
  await opportunity.save();

  await LeadActivity.create({
    opportunity_id: opportunity.opportunity_id,
    customer_id: opportunity.customer_id,
    type: 'followup.scheduled',
    title: 'Follow-up scheduled',
    description: `${followup.followup_type} on ${scheduledAt.toISOString()}`,
    changed_by: tenantContext.user_name || tenantContext.user_email,
  });

  await writeAuditLog({
    tenantContext,
    action: 'followup.created',
    entity_type: 'followup',
    entity_id: followup.followup_id,
    after: followup.toObject(),
    correlation_id,
    ip_address,
  });

  await publishEvent({
    type: 'followup.scheduled',
    opportunity_id: opportunity.opportunity_id,
    customer_id: opportunity.customer_id,
    payload: { followup_id: followup.followup_id },
    correlation_id,
  });

  return followup;
};

export const updateFollowup = async ({
  tenantContext,
  followupId,
  body,
  correlation_id,
  ip_address,
}) => {
  const followup = await Followup.findOne({ followup_id: followupId });
  if (!followup || !assertTenantAccess(followup, tenantContext)) {
    throw new ApiError(404, 'FOLLOWUP_NOT_FOUND', 'Follow-up not found');
  }

  const before = followup.toObject();

  if (body.status) followup.status = body.status;
  if (body.outcome !== undefined) followup.outcome = body.outcome;
  if (body.remarks !== undefined) followup.remarks = body.remarks;
  if (body.assigned_to) followup.assigned_to = body.assigned_to.trim();
  if (body.scheduled_at) {
    followup.scheduled_at = new Date(body.scheduled_at);
    followup.status = followup.scheduled_at <= new Date() ? 'DUE' : 'OPEN';
  }
  if (body.next_followup_at) followup.next_followup_at = new Date(body.next_followup_at);
  if (body.status === 'COMPLETED') followup.completed_at = new Date();

  await followup.save();

  if (body.status === 'COMPLETED') {
    const opp = await Opportunity.findOne({ opportunity_id: followup.opportunity_id });
    if (opp) {
      await LeadActivity.create({
        opportunity_id: opp.opportunity_id,
        customer_id: opp.customer_id,
        type: 'followup.completed',
        title: 'Follow-up completed',
        description: body.outcome || body.remarks || 'Completed',
        changed_by: tenantContext.user_name || tenantContext.user_email,
      });
    }
  }

  await writeAuditLog({
    tenantContext,
    action: 'followup.updated',
    entity_type: 'followup',
    entity_id: followup.followup_id,
    before,
    after: followup.toObject(),
    correlation_id,
    ip_address,
  });

  return followup;
};

export const listFollowups = async (tenantContext, query) => {
  const raw = getPagination(query);
  const limit = Math.min(raw.limit, 100);
  const { page, skip } = raw;
  const filter = buildTenantFilter(tenantContext);

  if (query.assigned_to) filter.assigned_to = query.assigned_to;
  if (query.status) filter.status = query.status;
  if (query.opportunity_id) filter.opportunity_id = query.opportunity_id;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  if (query.view === 'today') {
    filter.scheduled_at = { $gte: startOfDay, $lte: endOfDay };
    filter.status = { $in: ['OPEN', 'DUE'] };
  } else if (query.view === 'overdue') {
    filter.scheduled_at = { $lt: startOfDay };
    filter.status = { $in: ['OPEN', 'DUE', 'MISSED'] };
  } else if (query.view === 'upcoming') {
    filter.scheduled_at = { $gt: endOfDay };
    filter.status = { $in: ['OPEN', 'RESCHEDULED'] };
  }

  const [total, items] = await Promise.all([
    Followup.countDocuments(filter),
    Followup.find(filter).sort({ scheduled_at: 1 }).skip(skip).limit(limit).lean(),
  ]);

  return { items, meta: paginationMeta({ page, limit, total }) };
};

export const getFollowupsForLead = async (tenantContext, leadId) => {
  const opportunity = await resolveLead(leadId);
  if (!opportunity || !assertTenantAccess(opportunity, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }
  return Followup.find({
    ...buildTenantFilter(tenantContext),
    opportunity_id: opportunity.opportunity_id,
  })
    .sort({ scheduled_at: -1 })
    .limit(100)
    .lean();
};
