export const ok = (res, data, meta = {}) => {
  const status = meta.status || 200;
  const { status: _s, ...rest } = meta;
  return res.status(status).json({ data, meta: { correlation_id: res.locals.correlationId, ...rest } });
};

export const fail = (res, status, code, message, field) => res.status(status).json({ error: { code, message, field } });
