import { randomUUID } from 'crypto';
import TestDrive from '../../models/crm/TestDrive.js';
import Quotation from '../../models/crm/Quotation.js';
import Booking from '../../models/crm/Booking.js';
import Retail from '../../models/crm/Retail.js';
import Opportunity from '../../models/Opportunity.js';
import { buildTenantFilter, attachTenantToDoc } from '../../helpers/tenantScope.js';
import { assertTenantAccess } from '../../middleware/tenant.middleware.js';
import { ApiError } from '../../middleware/errorHandler.middleware.js';
import { getPagination, paginationMeta } from '../../helpers/pagination.js';
import { writeAuditLog } from '../audit.service.js';
import { enqueueConversionEvent } from '../integrations/conversionEvent.service.js';

const resolveLead = async (leadId) =>
  Opportunity.findOne({ $or: [{ opportunity_id: leadId }, { lead_id: leadId }] });

const assertLead = async (tenantContext, leadId) => {
  const opp = await resolveLead(leadId);
  if (!opp || !assertTenantAccess(opp, tenantContext)) {
    throw new ApiError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }
  return opp;
};

export const createTestDrive = async ({ tenantContext, leadId, body, correlation_id, ip_address }) => {
  const opp = await assertLead(tenantContext, leadId);
  const record = await TestDrive.create({
    test_drive_id: `TD-${randomUUID().slice(0, 8).toUpperCase()}`,
    opportunity_id: opp.opportunity_id,
    lead_id: opp.lead_id,
    customer_id: opp.customer_id,
    ...attachTenantToDoc(tenantContext, {}),
    scheduled_date: new Date(body.scheduled_date),
    scheduled_time: body.scheduled_time || null,
    product: body.product || opp.product,
    salesperson: body.salesperson || opp.current_owner,
    status: body.status || 'SCHEDULED',
    remarks: body.remarks || null,
    created_by: tenantContext.user_id,
  });
  await writeAuditLog({ tenantContext, action: 'test_drive.created', entity_type: 'test_drive', entity_id: record.test_drive_id, after: record.toObject(), correlation_id, ip_address });
  await enqueueConversionEvent({ tenantContext, opportunity: opp, event_type: 'test_drive', correlation_id });
  return record;
};

export const listTestDrives = async (tenantContext, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = buildTenantFilter(tenantContext);
  if (query.status) filter.status = query.status;
  const [total, items] = await Promise.all([
    TestDrive.countDocuments(filter),
    TestDrive.find(filter).sort({ scheduled_date: -1 }).skip(skip).limit(Math.min(limit, 100)).lean(),
  ]);
  return { items, meta: paginationMeta({ page, limit: Math.min(limit, 100), total }) };
};

export const updateTestDrive = async ({ tenantContext, id, body, correlation_id, ip_address }) => {
  const record = await TestDrive.findOne({ test_drive_id: id });
  if (!record || !assertTenantAccess(record, tenantContext)) throw new ApiError(404, 'NOT_FOUND', 'Test drive not found');
  const before = record.toObject();
  Object.assign(record, body);
  await record.save();
  await writeAuditLog({ tenantContext, action: 'test_drive.updated', entity_type: 'test_drive', entity_id: id, before, after: record.toObject(), correlation_id, ip_address });
  return record;
};

export const createQuotation = async ({ tenantContext, leadId, body, correlation_id, ip_address }) => {
  const opp = await assertLead(tenantContext, leadId);
  const record = await Quotation.create({
    quotation_id: `QT-${randomUUID().slice(0, 8).toUpperCase()}`,
    opportunity_id: opp.opportunity_id,
    lead_id: opp.lead_id,
    customer_id: opp.customer_id,
    ...attachTenantToDoc(tenantContext, {}),
    product: body.product || opp.product,
    amount: Number(body.amount),
    discount: Number(body.discount || 0),
    validity_until: body.validity_until ? new Date(body.validity_until) : null,
    status: body.status || 'DRAFT',
    remarks: body.remarks || null,
    created_by: tenantContext.user_id,
  });
  await writeAuditLog({ tenantContext, action: 'quotation.created', entity_type: 'quotation', entity_id: record.quotation_id, after: record.toObject(), correlation_id, ip_address });
  return record;
};

export const listQuotations = async (tenantContext, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = buildTenantFilter(tenantContext);
  const [total, items] = await Promise.all([
    Quotation.countDocuments(filter),
    Quotation.find(filter).sort({ created_at: -1 }).skip(skip).limit(Math.min(limit, 100)).lean(),
  ]);
  return { items, meta: paginationMeta({ page, limit: Math.min(limit, 100), total }) };
};

export const updateQuotation = async ({ tenantContext, id, body, correlation_id, ip_address }) => {
  const record = await Quotation.findOne({ quotation_id: id });
  if (!record || !assertTenantAccess(record, tenantContext)) throw new ApiError(404, 'NOT_FOUND', 'Quotation not found');
  const before = record.toObject();
  Object.assign(record, body);
  await record.save();
  await writeAuditLog({ tenantContext, action: 'quotation.updated', entity_type: 'quotation', entity_id: id, before, after: record.toObject(), correlation_id, ip_address });
  return record;
};

export const createBooking = async ({ tenantContext, leadId, body, correlation_id, ip_address }) => {
  const opp = await assertLead(tenantContext, leadId);
  const record = await Booking.create({
    booking_id: `BK-${randomUUID().slice(0, 8).toUpperCase()}`,
    opportunity_id: opp.opportunity_id,
    lead_id: opp.lead_id,
    customer_id: opp.customer_id,
    ...attachTenantToDoc(tenantContext, {}),
    product: body.product || opp.product,
    booking_date: new Date(body.booking_date),
    amount: body.amount != null ? Number(body.amount) : null,
    booking_reference: body.booking_reference || null,
    status: body.status || 'PENDING',
    remarks: body.remarks || null,
    created_by: tenantContext.user_id,
  });
  await writeAuditLog({ tenantContext, action: 'booking.created', entity_type: 'booking', entity_id: record.booking_id, after: record.toObject(), correlation_id, ip_address });
  await enqueueConversionEvent({ tenantContext, opportunity: opp, event_type: 'booking', event_value: record.amount, correlation_id });
  return record;
};

export const listBookings = async (tenantContext, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = buildTenantFilter(tenantContext);
  const [total, items] = await Promise.all([
    Booking.countDocuments(filter),
    Booking.find(filter).sort({ booking_date: -1 }).skip(skip).limit(Math.min(limit, 100)).lean(),
  ]);
  return { items, meta: paginationMeta({ page, limit: Math.min(limit, 100), total }) };
};

export const updateBooking = async ({ tenantContext, id, body, correlation_id, ip_address }) => {
  const record = await Booking.findOne({ booking_id: id });
  if (!record || !assertTenantAccess(record, tenantContext)) throw new ApiError(404, 'NOT_FOUND', 'Booking not found');
  const before = record.toObject();
  Object.assign(record, body);
  await record.save();
  await writeAuditLog({ tenantContext, action: 'booking.updated', entity_type: 'booking', entity_id: id, before, after: record.toObject(), correlation_id, ip_address });
  return record;
};

export const createRetail = async ({ tenantContext, leadId, body, correlation_id, ip_address }) => {
  const opp = await assertLead(tenantContext, leadId);
  const record = await Retail.create({
    retail_id: `RT-${randomUUID().slice(0, 8).toUpperCase()}`,
    opportunity_id: opp.opportunity_id,
    lead_id: opp.lead_id,
    customer_id: opp.customer_id,
    ...attachTenantToDoc(tenantContext, {}),
    retail_date: new Date(body.retail_date),
    product: body.product || opp.product,
    dealer_name: body.dealer_name || null,
    amount: body.amount != null ? Number(body.amount) : null,
    delivery_status: body.delivery_status || 'PENDING',
    remarks: body.remarks || null,
    created_by: tenantContext.user_id,
  });
  await writeAuditLog({ tenantContext, action: 'retail.created', entity_type: 'retail', entity_id: record.retail_id, after: record.toObject(), correlation_id, ip_address });
  await enqueueConversionEvent({ tenantContext, opportunity: opp, event_type: 'retail', event_value: record.amount, correlation_id });
  return record;
};

export const listRetail = async (tenantContext, query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = buildTenantFilter(tenantContext);
  const [total, items] = await Promise.all([
    Retail.countDocuments(filter),
    Retail.find(filter).sort({ retail_date: -1 }).skip(skip).limit(Math.min(limit, 100)).lean(),
  ]);
  return { items, meta: paginationMeta({ page, limit: Math.min(limit, 100), total }) };
};

export const updateRetail = async ({ tenantContext, id, body, correlation_id, ip_address }) => {
  const record = await Retail.findOne({ retail_id: id });
  if (!record || !assertTenantAccess(record, tenantContext)) throw new ApiError(404, 'NOT_FOUND', 'Retail record not found');
  const before = record.toObject();
  Object.assign(record, body);
  await record.save();
  await writeAuditLog({ tenantContext, action: 'retail.updated', entity_type: 'retail', entity_id: id, before, after: record.toObject(), correlation_id, ip_address });
  return record;
};
