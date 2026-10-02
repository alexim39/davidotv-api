import crypto from 'crypto';

/**
 * OBS-01: correlation IDs.
 * - Accepts inbound `x-request-id` (FE + service callers) or mints UUIDv4.
 * - Attaches `req.id`, echoes `x-request-id` on the response so the FE can
 *   surface it in error toasts / support reports.
 * - Must run FIRST so every log/error downstream carries it.
 */
export const requestId = (req, res, next) => {
  const incoming = req.headers?.['x-request-id'];
  const id =
    typeof incoming === 'string' && incoming.trim() ? incoming.trim().slice(0, 128) : crypto.randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
};

export default requestId;
