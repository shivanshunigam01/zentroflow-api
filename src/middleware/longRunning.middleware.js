/** Allow large Excel validate/import (nginx must also increase proxy_read_timeout). */
export const longRunningRequest = (timeoutMs = 600000) => (req, res, next) => {
  req.setTimeout(timeoutMs);
  res.setTimeout(timeoutMs);
  next();
};
