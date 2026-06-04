import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { downloadTemplate, generateImportIds, getLastImport, importLeads, validateImport } from '../controllers/leads.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { optionalExcelUpload } from '../middleware/optionalUpload.middleware.js';
import { importRowsValidator } from '../validators/import.validator.js';

const router = Router();

const importLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many import requests' } } });

router.get('/import/template', downloadTemplate);

router.post('/import/validate', optionalExcelUpload, importRowsValidator, validate, validateImport);
router.post('/import/generate-ids', optionalExcelUpload, importRowsValidator, validate, generateImportIds);
router.post('/import', importLimiter, optionalExcelUpload, importRowsValidator, validate, importLeads);
router.get('/import/latest', getLastImport);

export default router;
