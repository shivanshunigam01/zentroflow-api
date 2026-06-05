import XLSX from 'xlsx';
import ImportBatch from '../models/ImportBatch.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ok } from '../helpers/apiResponse.js';
import {
  rowsFromWorkbookBuffer,
  validateRows,
  attachGeneratedIds,
  commitImport,
  buildLeadTemplateWorkbook,
  filterLeadRows,
} from '../services/excelImport.service.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import {
  sendBulkWhatsAppCampaign,
  isWhatsAppCampaignConfigured,
} from '../services/whatsappCampaign.service.js';

const getRows = (req) => {
  if (req.file) return rowsFromWorkbookBuffer(req.file.buffer);
  return filterLeadRows(req.body.rows || []);
};

export const validateImport = asyncHandler(async (req, res) => {
  ok(res, await validateRows(getRows(req), { summaryOnly: true }));
});
export const generateImportIds = asyncHandler(async (req, res) => ok(res, attachGeneratedIds(getRows(req))));
export const importLeads = asyncHandler(async (req, res) => ok(res.status(201), await commitImport({ rows: getRows(req), imported_by: req.body.imported_by || req.user?.name || 'System', correlation_id: res.locals.correlationId })));

export const getLastImport = asyncHandler(async (req, res) => {
  const batch = await ImportBatch.findOne().sort({ created_at: -1 }).lean();
  ok(res, batch);
});

export const downloadTemplate = asyncHandler(async (req, res) => {
  const workbook = buildLeadTemplateWorkbook();
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="zentroflow-leads-template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

/** POST { mobiles: string[] } — up to 100 numbers per request, sent one-by-one. */
export const bulkWhatsAppCampaign = asyncHandler(async (req, res) => {
  if (!isWhatsAppCampaignConfigured()) {
    throw new ApiError(503, 'WHATSAPP_NOT_CONFIGURED', 'Set WHATSAPP_CAMPAIGN_API_KEY in server .env');
  }

  const mobiles = Array.isArray(req.body.mobiles) ? req.body.mobiles : [];
  if (mobiles.length === 0) {
    throw new ApiError(400, 'NO_MOBILES', 'Provide mobiles array');
  }
  if (mobiles.length > 100) {
    throw new ApiError(400, 'BATCH_TOO_LARGE', 'Maximum 100 numbers per request');
  }

  const result = await sendBulkWhatsAppCampaign(mobiles, { delayMs: req.body.delayMs });
  ok(res, result);
});
