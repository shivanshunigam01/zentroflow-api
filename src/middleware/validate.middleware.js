import { validationResult } from 'express-validator';
import { ApiError } from './errorHandler.middleware.js';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const first = errors.array()[0];
  return next(new ApiError(400, 'VALIDATION_ERROR', first.msg, first.path));
};
