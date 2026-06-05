import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { downloadTemplate, generateImportIds, getLastImport, importLeads, validateImport, bulkWhatsAppCampaign, bulkWhatsAppCount } from '../controllers/leads.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { optionalExcelUpload } from '../middleware/optionalUpload.middleware.js';
import { importRowsValidator } from '../validators/import.validator.js';
import { longRunningRequest } from '../middleware/longRunning.middleware.js';

const router = Router();

const importLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many import requests' } } });
const longImport = longRunningRequest(600000);
const longWhatsApp = longRunningRequest(900000);

router.get('/import/template', downloadTemplate);

router.get('/bulk-whatsapp/count', bulkWhatsAppCount);
router.post('/bulk-whatsapp', longWhatsApp, bulkWhatsAppCampaign);

router.post('/import/validate', longImport, optionalExcelUpload, importRowsValidator, validate, validateImport);
router.post('/import/generate-ids', longImport, optionalExcelUpload, importRowsValidator, validate, generateImportIds);
router.post('/import', longImport, importLimiter, optionalExcelUpload, importRowsValidator, validate, importLeads);
router.get('/import/latest', getLastImport);

export default router;
