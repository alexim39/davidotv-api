import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import { UserModel } from '../apps/user/models/user.model.js';

/**
 * JWT auth middleware - supports Bearer token or cookie `token`.
 * Attaches req.user.
 */
export const protect = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) token = authHeader.split(' ')[1];
    else if (req.cookies?.token) token = req.cookies.token;

    if (!token) return res.status(401).json({ success: false, message: 'Not authorized - no token' });

    const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
    const decoded = jwt.verify(token, secret);

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
