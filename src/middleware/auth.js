import logger from '../config/logger.js';
import { readRequestToken, verifyAuthToken } from '../config/auth.js';
import { UserModel } from '../apps/user/models/user.model.js';

/**
 * JWT auth middleware - single contract (SEC-02).
 * Accepts Bearer, new `token` cookie, or legacy `jwt` cookie; verifies with
 * unified JWT_SECRET (legacy JWTTOKENSECRET fallback during cutover).
 * Attaches req.user.
 */
export const protect = async (req, res, next) => {
  try {
    const token = readRequestToken(req);

    if (!token) return res.status(401).json({ success: false, message: 'Not authorized - no token' });

    const decoded = verifyAuthToken(token);

    const user = await UserModel.findById(decoded.id).select('-password').lean();
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    if (user.isDeleted || !user.isActive) return res.status(403).json({ success: false, message: 'Account inactive' });

    req.user = user;
    next();
  } catch (e) {
    logger.warn('Auth failed', { error: e.message });
    return res.status(401).json({ success: false, message: 'Not authorized - token invalid' });
  }
};

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new Error('Not authenticated'));
  if (!roles.includes(req.user.role)) {
    const err = new Error(`Role ${req.user.role} not authorized`);
    err.statusCode = 403;
    throw err;
  }
  next();
};

export default { protect, authorize };
