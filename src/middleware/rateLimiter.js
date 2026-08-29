let rateLimit = null;
try {
  const mod = await import('express-rate-limit');
  rateLimit = mod.default;
} catch {
  // Fallback no-op if not installed - avoids crash, BE still runs
  rateLimit = () => (req, _res, next) => next();
}

/**
 * Rate limiters per domain.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, slow down' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts' },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Upload limit reached, try later' },
});

export default { apiLimiter, authLimiter, uploadLimiter };
