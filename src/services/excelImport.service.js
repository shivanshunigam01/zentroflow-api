import XLSX from 'xlsx';
import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import Opportunity from '../models/Opportunity.js';
import ImportBatch from '../models/ImportBatch.js';
import { generateIds } from './idGeneration.service.js';
import { normalizeMobile, isValidMobile } from '../helpers/mobile.js';
import { classifyDuplicate } from './duplicate.service.js';
import { publishEvent } from './event.service.js';

export const rowsFromWorkbookBuffer = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
};

const normalizeRow = (row) => ({
  customerName: row.customerName || row['Customer Name'] || row.name || row.Name,
  mobile: row.mobile || row.Mobile || row.phone || row.Phone,
  product: row.product || row.Product,
  requirement: row.requirement || row.Requirement || '',
  district: row.district || row.District || row.address || row.Address,
  source: row.source || row.Source || 'Excel Import',
  branch: row.branch || row.Branch || 'Default Branch',
  executive: row.executive || row.Executive || row.owner || row.Owner || 'Sales Executive',
  leadId: row.leadId || row.lead_id,
  customerId: row.customerId || row.customer_id,
  opportunityId: row.opportunityId || row.opportunity_id,
});

export const validateRows = async (rows = []) => {
  const output = [];
  let valid = 0, invalid = 0, duplicate = 0;
  for (const raw of rows.map(normalizeRow)) {
    const errors = [];
    if (!raw.customerName) errors.push('customerName is required');
    if (!isValidMobile(raw.mobile)) errors.push('valid Indian mobile is required');
    if (!raw.product) errors.push('product is required');
    let isDuplicate = false;
    if (!errors.length) {
      const customer = await Customer.findOne({ mobile_normalized: normalizeMobile(raw.mobile) });
      if (customer) {
        const dup = await classifyDuplicate({ customer_id: customer.customer_id, product: raw.product, requirement: raw.requirement });
        isDuplicate = dup.duplicate;
      }
    }
    if (errors.length) invalid += 1; else if (isDuplicate) duplicate += 1; else valid += 1;
    output.push({ ...raw, valid: !errors.length && !isDuplicate, duplicate: isDuplicate, errors });
  }
  return { total: rows.length, valid, duplicate, invalid, outOfTerritory: 0, rows: output };
};

export const attachGeneratedIds = (rows = []) => rows.map((row) => {
  const clean = normalizeRow(row);
  const ids = generateIds(clean.customerName);
  return { ...clean, leadId: clean.leadId || ids.lead_id, customerId: clean.customerId || ids.customer_id, opportunityId: clean.opportunityId || ids.opportunity_id };
});

export const commitImport = async ({ rows = [], imported_by = 'System', correlation_id }) => {
  const prepared = attachGeneratedIds(rows);
  const validation = await validateRows(prepared);
  let imported = 0;
  const rejectedRows = [];
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    for (const row of validation.rows) {
      if (!row.valid) { rejectedRows.push(row); continue; }
      const mobile_normalized = normalizeMobile(row.mobile);
      let customer = await Customer.findOne({ mobile_normalized }).session(session);
      if (!customer) {
        customer = await Customer.create([{ customer_id: row.customerId, name: row.customerName, mobile: row.mobile, mobile_normalized, address: row.district, customer_type: 'Individual' }], { session }).then(([doc]) => doc);
      }
      const opportunity = await Opportunity.create([{
        opportunity_id: row.opportunityId,
        lead_id: row.leadId,
        customer_id: customer.customer_id,
        product: row.product,
        requirement: row.requirement,
        current_owner: row.executive,
        source: row.source,
        branch: row.branch,
        escalation_owner: 'Sales Manager',
      }], { session }).then(([doc]) => doc);
      await publishEvent({ type: 'lead.created', opportunity_id: opportunity.opportunity_id, customer_id: customer.customer_id, payload: row, correlation_id });
      imported += 1;
    }
    await ImportBatch.create([{ ...validation, imported, rejected: rejectedRows.length, rows: rejectedRows, imported_by }], { session });
  });
  await session.endSession();
  return { ...validation, imported, rejected: rejectedRows.length, rows: rejectedRows };
};
