import logger from '../config/logger.js';

/**
 * Global error handler - must be last middleware.
 * Normalises Mongoose, JWT, Multer errors into JSON.
 */
export const errorHandler = (err, req, res, _next) => {
  const status = err.statusCode || err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';

  logger.error(err.message, {
    status,
    method: req.method,
    path: req.originalUrl,
    stack: err.stack,
  });

  // Multer file size
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large (≤ 100MB)' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: 'Unexpected file field' });
  }

  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(isProd ? {} : { stack: err.stack }),
  });
};

export const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
};

export default errorHandler;
