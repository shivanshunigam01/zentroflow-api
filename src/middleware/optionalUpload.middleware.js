import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) return cb(null, true);
    cb(new Error('Only .xlsx, .xls, or .csv files are allowed'));
  },
});

/** Apply multer only for multipart requests; JSON `{ rows: [...] }` passes through. */
export const optionalExcelUpload = (req, res, next) => {
  const type = req.headers['content-type'] || '';
  if (!type.includes('multipart/form-data')) return next();
  return upload.single('file')(req, res, next);
};
