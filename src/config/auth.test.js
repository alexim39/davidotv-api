import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// SEC-02 contract tests: single JWT secret, dual cookies, transport priority.
// No DB, no network — getJwtSecret() reads env lazily so tests control it.
import {
  getJwtSecret,
  signAuthToken,
  verifyAuthToken,
  readRequestToken,
  setAuthCookies,
  clearAuthCookies,
} from './auth.js';

const OLD_ENV = { ...process.env };

const mockRes = () => {
  const cookies = {};
  return {
    cookies,
    cookie: vi.fn((name, value, opts) => { cookies[name] = { value, opts }; }),
  };
};

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-123';
  delete process.env.JWTTOKENSECRET;
  delete process.env.NODE_ENV;
});

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe('getJwtSecret', () => {
  it('prefers JWT_SECRET', () => {
    process.env.JWTTOKENSECRET = 'legacy-secret';
    expect(getJwtSecret()).toBe('test-secret-123');
  });

  it('falls back to legacy JWTTOKENSECRET during cutover', () => {
    delete process.env.JWT_SECRET;
    process.env.JWTTOKENSECRET = 'legacy-secret';
    expect(getJwtSecret()).toBe('legacy-secret');
  });

  it('throws when no secret is configured', () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWTTOKENSECRET;
    expect(() => getJwtSecret()).toThrow('JWT secret not configured');
  });
});

describe('sign/verify roundtrip', () => {
  it('preserves the user id with 1d expiry shape', () => {
    const token = signAuthToken('user-abc');
    const decoded = verifyAuthToken(token);
    expect(decoded.id).toBe('user-abc');
  });

  it('rejects tampered tokens', () => {
    const token = signAuthToken('user-abc');
    expect(() => verifyAuthToken(token.slice(0, -2) + 'xx')).toThrow();
  });

  it('rejects tokens signed with another secret (legacy/new mismatch guard)', () => {
    const token = signAuthToken('user-abc');
    process.env.JWT_SECRET = 'different-secret';
    expect(() => verifyAuthToken(token)).toThrow();
  });
});

describe('readRequestToken priority', () => {
  it('prefers Bearer over cookies', () => {
    const req = { headers: { authorization: 'Bearer abc' }, cookies: { token: 't', jwt: 'j' } };
    expect(readRequestToken(req)).toBe('abc');
  });

  it('reads new token cookie before legacy jwt cookie', () => {
    const req = { headers: {}, cookies: { token: 't', jwt: 'j' } };
    expect(readRequestToken(req)).toBe('t');
  });

  it('falls back to legacy jwt cookie', () => {
    const req = { headers: {}, cookies: { jwt: 'j' } };
    expect(readRequestToken(req)).toBe('j');
  });

  it('returns null when nothing is present', () => {
    expect(readRequestToken({ headers: {}, cookies: {} })).toBeNull();
  });
});

describe('cookie helpers', () => {
  it('sets BOTH jwt (legacy) and token (new) with the same value', () => {
    const res = mockRes();
    setAuthCookies(res, 'tok-123');
    expect(res.cookies.jwt.value).toBe('tok-123');
    expect(res.cookies.token.value).toBe('tok-123');
    expect(res.cookies.jwt.opts.httpOnly).toBe(true);
  });

  it('uses http-friendly flags outside production (dev cookie fix)', () => {
    const res = mockRes();
    setAuthCookies(res, 'tok-123');
    expect(res.cookies.jwt.opts.secure).toBe(false);
    expect(res.cookies.jwt.opts.sameSite).toBe('lax');
  });

  it('uses secure flags in production', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    setAuthCookies(res, 'tok-123');
    expect(res.cookies.jwt.opts.secure).toBe(true);
    expect(res.cookies.jwt.opts.sameSite).toBe('none');
  });

  it('clears both cookies on signout', () => {
    const res = mockRes();
    clearAuthCookies(res);
    expect(res.cookies.jwt.value).toBe('');
    expect(res.cookies.token.value).toBe('');
    expect(res.cookies.jwt.opts.maxAge).toBe(0);
  });
});
