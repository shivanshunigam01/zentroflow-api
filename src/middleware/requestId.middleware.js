import { createCorrelationId } from '../helpers/correlationId.js';

export const requestId = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || createCorrelationId();
  res.locals.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
};
