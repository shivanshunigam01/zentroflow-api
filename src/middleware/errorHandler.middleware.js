export class ApiError extends Error {
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export const notFound = (req, res, next) => next(new ApiError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));

export const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');
  const message = status === 500 ? 'Something went wrong' : err.message;

  if (process.env.NODE_ENV !== 'production') console.error(err);

  res.status(status).json({
    error: { code, message, field: err.field },
    meta: { correlation_id: res.locals.correlationId },
  });
};
