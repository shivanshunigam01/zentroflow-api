/** Capture raw body for webhook signature verification. */
export const captureRawBody = (req, res, buf) => {
  if (buf?.length) req.rawBody = buf.toString('utf8');
};
