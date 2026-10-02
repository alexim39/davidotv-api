import { describe, it, expect, vi } from 'vitest';
import { requestId } from './requestId.js';

const mockRes = () => {
  const headers = {};
  return {
    headers,
    setHeader: vi.fn((k, v) => { headers[k] = v; }),
  };
};

describe('requestId', () => {
  it('mints a UUID when no inbound id exists', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();
    requestId(req, res, next);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['x-request-id']).toBe(req.id);
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes through a caller-supplied x-request-id', () => {
    const req = { headers: { 'x-request-id': 'fe-123' } };
    const res = mockRes();
    requestId(req, res, () => {});
    expect(req.id).toBe('fe-123');
    expect(res.headers['x-request-id']).toBe('fe-123');
  });

  it('trims and caps overlong inbound ids', () => {
    const req = { headers: { 'x-request-id': '  ' + 'x'.repeat(200) } };
    requestId(req, mockRes(), () => {});
    expect(req.id.length).toBeLessThanOrEqual(128);
  });
});
