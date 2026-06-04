import XLSX from 'xlsx';
import ImportBatch from '../models/ImportBatch.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';
import { rowsFromWorkbookBuffer, validateRows, attachGeneratedIds, commitImport } from '../services/excelImport.service.js';

const getRows = (req) => (req.file ? rowsFromWorkbookBuffer(req.file.buffer) : req.body.rows || []);

export const validateImport = asyncHandler(async (req, res) => ok(res, await validateRows(getRows(req))));
export const generateImportIds = asyncHandler(async (req, res) => ok(res, attachGeneratedIds(getRows(req))));
export const importLeads = asyncHandler(async (req, res) => ok(res.status(201), await commitImport({ rows: getRows(req), imported_by: req.body.imported_by || req.user?.name || 'System', correlation_id: res.locals.correlationId })));

export const getLastImport = asyncHandler(async (req, res) => {
  const batch = await ImportBatch.findOne().sort({ created_at: -1 }).lean();
  ok(res, batch);
});

export const downloadTemplate = asyncHandler(async (req, res) => {
  const rows = [{
    customerName: 'ABC Logistics',
    mobile: '9988776655',
    product: 'Tata Ace',
    requirement: 'Standard',
    district: 'Chennai',
    source: 'Walk-in',
    branch: 'Chennai Central',
    executive: 'Sales Executive',
  }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Leads');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="zentroflow-leads-template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});
