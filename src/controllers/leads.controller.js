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
import { createManualLead } from '../services/manualLeadCreate.service.js';
import Customer from '../models/Customer.js';
import { ApiError } from '../middleware/errorHandler.middleware.js';
import {
  sendBulkWhatsAppCampaign,
  isWhatsAppCampaignConfigured,
  formatWhatsAppDestination,
} from '../services/whatsappCampaign.service.js';
import {
  buildWhatsAppCampaignReport,
  isAisensyConnectConfigured,
} from '../services/aisensyConnect.service.js';

const loadCustomerMobilesPage = async (page = 0, pageSize = 100) => {
  const customers = await Customer.find({}, { mobile: 1, mobile_normalized: 1 })
    .sort({ _id: 1 })
    .skip(page * pageSize)
    .limit(pageSize)
    .lean();
  return {
    mobiles: customers.map((c) => c.mobile || c.mobile_normalized).filter(Boolean),
    hasMore: customers.length === pageSize,
  };
};

/** GET — unique valid WhatsApp destinations in full database (not inbox UI cap). */
export const bulkWhatsAppCount = asyncHandler(async (req, res) => {
  const customers = await Customer.find({}, { mobile: 1, mobile_normalized: 1 }).lean();
  const unique = new Set();
  for (const c of customers) {
    const dest = formatWhatsAppDestination(c.mobile || c.mobile_normalized);
    if (dest) unique.add(dest);
  }
  ok(res, {
    totalCustomers: customers.length,
    uniqueContacts: unique.size,
  });
});

/** POST { mobiles?: string[], all?: boolean, page?: number, pageSize?: number } */
export const bulkWhatsAppCampaign = asyncHandler(async (req, res) => {
  if (!isWhatsAppCampaignConfigured()) {
    throw new ApiError(503, 'WHATSAPP_NOT_CONFIGURED', 'Set WHATSAPP_CAMPAIGN_API_KEY in server .env');
  }

  const pageSize = Math.min(Math.max(Number(req.body.pageSize || 100), 1), 100);
  let mobiles = [];

  if (req.body.all === true) {
    const page = Math.max(Number(req.body.page || 0), 0);
    const batch = await loadCustomerMobilesPage(page, pageSize);
    mobiles = batch.mobiles;
    if (mobiles.length === 0 && !batch.hasMore) {
      throw new ApiError(400, 'NO_MOBILES', 'No contacts in this batch');
    }
    if (mobiles.length === 0) {
      ok(res, { total: 0, sent: 0, failed: 0, errors: [], page, pageSize, hasMore: batch.hasMore });
      return;
    }
    const result = await sendBulkWhatsAppCampaign(mobiles, { delayMs: req.body.delayMs });
    ok(res, { ...result, page, pageSize, hasMore: batch.hasMore });
    return;
  }

  mobiles = Array.isArray(req.body.mobiles) ? req.body.mobiles : [];

  if (mobiles.length === 0) {
    throw new ApiError(400, 'NO_MOBILES', 'Provide mobiles array or all: true');
  }
  if (mobiles.length > 100) {
    throw new ApiError(400, 'BATCH_TOO_LARGE', 'Maximum 100 numbers per request');
  }

  const result = await sendBulkWhatsAppCampaign(mobiles, { delayMs: req.body.delayMs });
  ok(res, result);
});

/** GET — campaign delivery report from AiSensy connect API (sent/delivered/read/replied/failed). */
export const bulkWhatsAppReport = asyncHandler(async (req, res) => {
  if (!isAisensyConnectConfigured()) {
    throw new ApiError(
      503,
      'AISENSY_NOT_CONFIGURED',
      'Set AISENSY_PARTNER_API_KEY and WHATSAPP_CAMPAIGN_API_KEY (or WHATSAPP_PROJECT_ID) in server .env',
    );
  }

  const report = await buildWhatsAppCampaignReport({
    campaignName: req.query.campaignName || undefined,
  });

  ok(res, report);
});

const getRows = (req) => {
  if (req.file) return rowsFromWorkbookBuffer(req.file.buffer);
  return filterLeadRows(req.body.rows || []);
};

export const createLead = asyncHandler(async (req, res) => {
  const dto = await createManualLead(req.body, req.user?.name || req.user?.email || 'System');
  ok(res, dto, { status: 201 });
});

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

