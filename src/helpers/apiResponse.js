export const ok = (res, data, meta = {}) => res.json({ data, meta: { correlation_id: res.locals.correlationId, ...meta } });

export const fail = (res, status, code, message, field) => res.status(status).json({ error: { code, message, field } });
