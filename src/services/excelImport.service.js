import XLSX from 'xlsx';
import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import Opportunity from '../models/Opportunity.js';
import ImportBatch from '../models/ImportBatch.js';
import { generateIds } from './idGeneration.service.js';
import { normalizeMobile, isValidMobile } from '../helpers/mobile.js';
import { publishEvent } from './event.service.js';

const DB_IN_CHUNK = 2000;
const SAMPLE_ROW_LIMIT = 40;

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
  return json.map(normalizeRow);
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

/** One DB query (chunked) instead of per-row lookups. */
const fetchExistingMobileSet = async (mobileNorms) => {
  const existing = new Set();
  for (let i = 0; i < mobileNorms.length; i += DB_IN_CHUNK) {
    const chunk = mobileNorms.slice(i, i + DB_IN_CHUNK);
    const docs = await Customer.find(
      { mobile_normalized: { $in: chunk } },
      { mobile_normalized: 1 },
    ).lean();
    for (const doc of docs) existing.add(doc.mobile_normalized);
  }
  return existing;
};

/**
 * Classify rows for validate/import. Returns valid rows for commit + summary counts.
 */
export const classifyImportRows = async (rows = []) => {
  const leadRows = rows.map((row) => applyImportDefaults(normalizeRow(row)));
  const seenInFile = new Set();
  const normsForDb = [];
  const staged = [];

  for (const raw of leadRows) {
    const mobileNorm = normalizeMobile(raw.mobile);
    const errors = [];

    if (!isValidMobile(raw.mobile)) {
      errors.push('valid Indian mobile is required');
    } else if (seenInFile.has(mobileNorm)) {
      errors.push('duplicate mobile in file');
    } else {
      seenInFile.add(mobileNorm);
      normsForDb.push(mobileNorm);
    }

    staged.push({ raw, mobileNorm, errors });
  }

  const existingInDb = await fetchExistingMobileSet(normsForDb);

  const allRows = [];
  const validRows = [];
  const rejectedRows = [];
  let valid = 0;
  let invalid = 0;
  let duplicate = 0;

  for (const { raw, mobileNorm, errors: baseErrors } of staged) {
    const errors = [...baseErrors];
    if (!errors.length && existingInDb.has(mobileNorm)) {
      errors.push('mobile already registered');
    }

    const isDup = errors.some((e) => e.includes('duplicate') || e.includes('already registered'));
    const isInvalid = errors.some((e) => e.includes('valid Indian mobile'));
    const rowOut = {
      ...raw,
      mobile_normalized: mobileNorm,
      valid: !errors.length,
      duplicate: isDup,
      errors: errors.length ? errors : undefined,
    };

    allRows.push(rowOut);
    if (isInvalid) invalid += 1;
    else if (isDup) duplicate += 1;
    else {
      valid += 1;
      validRows.push(rowOut);
    }
    if (errors.length) rejectedRows.push(rowOut);
  }

  const sampleRows = rejectedRows.slice(0, SAMPLE_ROW_LIMIT);

  return {
    total: leadRows.length,
    valid,
    duplicate,
    invalid,
    outOfTerritory: 0,
    validRows,
    rejectedRows,
    allRows,
    sampleRows,
  };
};

/** Fast validate — summary counts + small sample of problem rows only. */
export const validateRows = async (rows = [], { summaryOnly = true } = {}) => {
  const result = await classifyImportRows(rows);
  return {
    total: result.total,
    valid: result.valid,
    duplicate: result.duplicate,
    invalid: result.invalid,
    outOfTerritory: result.outOfTerritory,
    rows: summaryOnly ? result.sampleRows : result.allRows,
  };
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

const BULK_INSERT_CHUNK = 250;

const insertInChunks = async (Model, docs, session) => {
  for (let i = 0; i < docs.length; i += BULK_INSERT_CHUNK) {
    const chunk = docs.slice(i, i + BULK_INSERT_CHUNK);
    if (chunk.length) await Model.insertMany(chunk, { session, ordered: false });
  }
};

export const commitImport = async ({ rows = [], imported_by = 'System', correlation_id }) => {
  const prepared = attachGeneratedIds(rows);
  const classified = await classifyImportRows(prepared);
  const validRows = classified.validRows;
  let imported = 0;
  const session = await mongoose.startSession();

  await session.withTransaction(async () => {
    const validMobiles = validRows.map((r) => normalizeMobile(r.mobile));
    const existingCustomers = validMobiles.length
      ? await Customer.find({ mobile_normalized: { $in: validMobiles } }).session(session).lean()
      : [];
    const customerByMobile = new Map(existingCustomers.map((c) => [c.mobile_normalized, c]));

    const customersToInsert = [];
    for (const row of validRows) {
      const mobile_normalized = normalizeMobile(row.mobile);
      if (customerByMobile.has(mobile_normalized)) continue;
      const doc = {
        customer_id: row.customerId,
        name: row.customerName,
        mobile: String(row.mobile),
        mobile_normalized,
        address: row.district || undefined,
        customer_type: 'Individual',
      };
      customersToInsert.push(doc);
      customerByMobile.set(mobile_normalized, doc);
    }

    await insertInChunks(Customer, customersToInsert, session);

    const opportunitiesToInsert = validRows.map((row) => {
      const mobile_normalized = normalizeMobile(row.mobile);
      const customer = customerByMobile.get(mobile_normalized);
      return {
        opportunity_id: row.opportunityId,
        lead_id: row.leadId,
        customer_id: customer.customer_id,
        product: row.product,
        requirement: row.requirement || undefined,
        current_owner: row.executive,
        source: row.source,
        branch: row.branch,
        escalation_owner: 'Sales Manager',
      };
    });

    await insertInChunks(Opportunity, opportunitiesToInsert, session);
    imported = validRows.length;

    await ImportBatch.create([{
      total: classified.total,
      valid: classified.valid,
      duplicate: classified.duplicate,
      invalid: classified.invalid,
      outOfTerritory: 0,
      imported,
      rejected: classified.rejectedRows.length,
      rows: classified.sampleRows,
      imported_by,
    }], { session });
  });

  await session.endSession();

  if (imported > 0) {
    void publishEvent({
      type: 'import.batch.completed',
      payload: { imported, imported_by },
      correlation_id,
    });
  }

  return {
    total: classified.total,
    valid: classified.valid,
    duplicate: classified.duplicate,
    invalid: classified.invalid,
    outOfTerritory: 0,
    imported,
    rejected: classified.rejectedRows.length,
    rows: classified.sampleRows,
  };
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
