import { describe, it, expect } from 'vitest';
import { errorHandler, notFound } from './errorHandler.js';

const mockRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

describe('errorHandler', () => {
  it('maps Multer LIMIT_FILE_SIZE to 413', () => {
    const res = mockRes();
    const err = new Error('File too large');
    err.code = 'LIMIT_FILE_SIZE';
    errorHandler(err, { method: 'POST', originalUrl: '/talent-upload' }, res, () => {});
    expect(res.statusCode).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it('maps Multer LIMIT_UNEXPECTED_FILE to 400', () => {
    const res = mockRes();
    const err = new Error('Unexpected field');
    err.code = 'LIMIT_UNEXPECTED_FILE';
    errorHandler(err, { method: 'POST', originalUrl: '/talent-upload' }, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('honours err.statusCode (e.g. authorize 403)', () => {
    const res = mockRes();
    const err = new Error('Role user not authorized');
    err.statusCode = 403;
    errorHandler(err, { method: 'POST', originalUrl: '/x' }, res, () => {});
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Role user not authorized');
  });

  it('defaults to 500 with a generic message', () => {
    const res = mockRes();
    errorHandler(new Error('boom'), { method: 'GET', originalUrl: '/x' }, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('notFound', () => {
  it('returns 404 naming the route', () => {
    const res = mockRes();
    notFound({ originalUrl: '/nope' }, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toContain('/nope');
  });
});
