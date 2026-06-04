import XLSX from 'xlsx';
import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import Opportunity from '../models/Opportunity.js';
import ImportBatch from '../models/ImportBatch.js';
import { generateIds } from './idGeneration.service.js';
import { normalizeMobile, isValidMobile } from '../helpers/mobile.js';
import { publishEvent } from './event.service.js';

const normalizeHeader = (h) => String(h).trim().toLowerCase();

const coerceMobile = (value) => {
  if (value == null || value === '') return '';
  return String(value).trim();
};

const sheetHasLeadColumns = (sheet) => {
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!json.length) return false;
  const keys = Object.keys(json[0]).map(normalizeHeader);
  return keys.some((k) => ['mobile', 'phone', 'mobile number', 'customername', 'customer name'].includes(k));
};

const selectImportSheet = (workbook) => {
  const preferred = workbook.SheetNames.find((n) => /^(row details|leads)$/i.test(n.trim()));
  if (preferred) {
    const sheet = workbook.Sheets[preferred];
    if (sheetHasLeadColumns(sheet)) return sheet;
  }
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (sheetHasLeadColumns(sheet)) return sheet;
  }
  return workbook.Sheets[workbook.SheetNames[0]];
};

export const rowsFromWorkbookBuffer = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = selectImportSheet(workbook);
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return json.map(normalizeRow).filter((r) => isValidMobile(r.mobile));
};

export const normalizeRow = (row) => ({
  customerName:
    row.customerName
    || row.customername
    || row['Customer Name']
    || row.name
    || row.Name
    || row.customer
    || row.Customer,
  mobile: coerceMobile(
    row.mobile
    || row.Mobile
    || row.phone
    || row.Phone
    || row['Mobile Number'],
  ),
  product:
    row.product
    || row.Product
    || row['Product Interest']
    || row.model
    || row.Model,
  requirement: row.requirement || row.Requirement || row.remarks || row.Remarks || '',
  district: row.district || row.District || row.address || row.Address || row.city || row.City,
  source: row.source || row.Source || row['Lead Source'] || 'Excel Import',
  branch: row.branch || row.Branch || 'Default Branch',
  executive: row.executive || row.Executive || row.owner || row.Owner || row['Assigned To'] || 'Sales Executive',
  leadId: row.leadId || row.lead_id,
  customerId: row.customerId || row.customer_id,
  opportunityId: row.opportunityId || row.opportunity_id,
});

/** Only valid mobile required; name/product get defaults when missing. */
export const applyImportDefaults = (row) => {
  const mobile = coerceMobile(row.mobile);
  const mobileNorm = normalizeMobile(mobile);
  const customerName = String(row.customerName || '').trim() || `Lead ${mobileNorm}`;
  const product = String(row.product || '').trim() || 'General';
  return {
    ...row,
    mobile,
    customerName,
    product,
    requirement: row.requirement || '',
    source: row.source || 'Excel Import',
    branch: row.branch || 'Default Branch',
    executive: row.executive || 'Sales Executive',
  };
};

const isLeadPayloadRow = (row) => isValidMobile(normalizeRow(row).mobile);

export const filterLeadRows = (rows = []) => rows.filter(isLeadPayloadRow);

/** Unique mobile = importable; mobile already in DB or repeated in file = duplicate. */
export const validateRows = async (rows = []) => {
  const leadRows = filterLeadRows(rows).map((row) => applyImportDefaults(normalizeRow(row)));
  const output = [];
  const seenInFile = new Set();
  let valid = 0;
  let invalid = 0;
  let duplicate = 0;

  for (const raw of leadRows) {
    const errors = [];
    const mobileNorm = normalizeMobile(raw.mobile);

    if (!isValidMobile(raw.mobile)) {
      errors.push('valid Indian mobile is required');
    } else if (seenInFile.has(mobileNorm)) {
      errors.push('duplicate mobile in file');
    } else {
      seenInFile.add(mobileNorm);
      const existing = await Customer.findOne({ mobile_normalized: mobileNorm }).lean();
      if (existing) errors.push('mobile already registered');
    }

    const isDup = errors.some((e) => e.includes('duplicate') || e.includes('already registered'));
    const isInvalid = errors.some((e) => e.includes('valid Indian mobile'));

    if (isInvalid) invalid += 1;
    else if (isDup) duplicate += 1;
    else valid += 1;

    output.push({
      ...raw,
      valid: !errors.length,
      duplicate: isDup,
      errors: errors.length ? errors : undefined,
    });
  }

  return { total: leadRows.length, valid, duplicate, invalid, outOfTerritory: 0, rows: output };
};

export const attachGeneratedIds = (rows = []) => filterLeadRows(rows).map((row) => {
  const clean = applyImportDefaults(normalizeRow(row));
  const ids = generateIds(clean.customerName);
  return {
    ...clean,
    leadId: clean.leadId || ids.lead_id,
    customerId: clean.customerId || ids.customer_id,
    opportunityId: clean.opportunityId || ids.opportunity_id,
  };
});

export const commitImport = async ({ rows = [], imported_by = 'System', correlation_id }) => {
  const prepared = attachGeneratedIds(rows);
  const validation = await validateRows(prepared);
  let imported = 0;
  const rejectedRows = [];
  const session = await mongoose.startSession();
  await session.withTransaction(async () => {
    for (const row of validation.rows) {
      if (!row.valid) {
        rejectedRows.push(row);
        continue;
      }
      const mobile_normalized = normalizeMobile(row.mobile);
      let customer = await Customer.findOne({ mobile_normalized }).session(session);
      if (!customer) {
        customer = await Customer.create([{
          customer_id: row.customerId,
          name: row.customerName,
          mobile: row.mobile,
          mobile_normalized,
          address: row.district || undefined,
          customer_type: 'Individual',
        }], { session }).then(([doc]) => doc);
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
      await publishEvent({
        type: 'lead.created',
        opportunity_id: opportunity.opportunity_id,
        customer_id: customer.customer_id,
        payload: row,
        correlation_id,
      });
      imported += 1;
    }
    await ImportBatch.create([{
      ...validation,
      imported,
      rejected: rejectedRows.length,
      rows: rejectedRows,
      imported_by,
    }], { session });
  });
  await session.endSession();
  return { ...validation, imported, rejected: rejectedRows.length, rows: rejectedRows };
};

/** Standard upload template headers (row 1 in Excel). */
export const LEAD_TEMPLATE_HEADERS = [
  'customerName',
  'mobile',
  'product',
  'requirement',
  'district',
  'source',
  'branch',
  'executive',
];

export const LEAD_TEMPLATE_SAMPLE_ROW = [
  'ABC Logistics',
  '9988776655',
  'Tata Ace',
  'ops@abc.in',
  'Chennai',
  'Walk-in',
  'Chennai Central',
  'Sales Executive',
];

export const buildLeadTemplateWorkbook = () => {
  const sheet = XLSX.utils.aoa_to_sheet([LEAD_TEMPLATE_HEADERS, LEAD_TEMPLATE_SAMPLE_ROW]);
  sheet['!cols'] = LEAD_TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Leads');
  return workbook;
};
