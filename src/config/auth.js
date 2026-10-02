import jwt from 'jsonwebtoken';
import logger from './logger.js';

/**
 * Single auth contract (SEC-02).
 *
 * - One secret: JWT_SECRET (falls back to legacy JWTTOKENSECRET during cutover).
 * - One payload: { id } with 1d expiry (matches legacy auth.controller).
 * - Cookies: sets BOTH `jwt` (legacy) and `token` (new) with the same value so
 *   old `GET /auth` (reads `jwt`) and new `protect` (reads `token`/Bearer) agree.
 * - Flags are env-aware: Secure+SameSite=None only in production; http dev uses
 *   HttpOnly + SameSite=Lax so the cookie is actually stored (legacy `secure:true`
 *   broke http://localhost:4200 dev).
 */

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || process.env.JWTTOKENSECRET;
  if (!secret) {
    logger.error('Missing JWT secret (JWT_SECRET)');
    throw new Error('JWT secret not configured');
  }
  if (!process.env.JWT_SECRET && process.env.JWTTOKENSECRET) {
    logger.warn('Using legacy JWTTOKENSECRET — set JWT_SECRET to complete SEC-02 cutover');
  }
  return secret;
};

export const signAuthToken = (userId) =>
  jwt.sign({ id: userId }, getJwtSecret(), { expiresIn: '1d' });

export const verifyAuthToken = (token) => jwt.verify(token, getJwtSecret());

const isProd = () => process.env.NODE_ENV === 'production';

export const authCookieOptions = () => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: isProd() ? 'none' : 'lax',
  maxAge: 24 * 60 * 60 * 1000,
});

export const clearAuthCookieOptions = () => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: isProd() ? 'none' : 'lax',
  maxAge: 0,
});

/** Read token from Bearer, new `token` cookie, or legacy `jwt` cookie. */
export const readRequestToken = (req) => {
  const header = req.headers?.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.token || req.cookies?.jwt || null;
};

/** Set both cookies so legacy + new readers agree. */
export const setAuthCookies = (res, token) => {
  const opts = authCookieOptions();
  res.cookie('jwt', token, opts); // legacy reader: getUser
  res.cookie('token', token, opts); // new reader: protect
};

export const clearAuthCookies = (res) => {
  const opts = clearAuthCookieOptions();
  res.cookie('jwt', '', opts);
  res.cookie('token', '', opts);
};

export default { getJwtSecret, signAuthToken, verifyAuthToken, authCookieOptions, readRequestToken, setAuthCookies, clearAuthCookies };
