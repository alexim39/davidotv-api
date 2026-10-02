import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

// API-01 mount/contract tests: no DB, no network. All assertions hit paths
// that resolve before any database access (discovery, 404, auth gates).

const app = createApp();

describe('versioning (API-01)', () => {
  it('serves the v1 discovery document', async () => {
    const res = await request(app).get('/api/v1');
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('v1');
    expect(res.body.mounts).toContain('identity');
    expect(res.body.mounts).toContain('orders');
  });

  it('aliases /api and /api/v1 for modular routers', async () => {
    // No token → protect 401s identically on both prefixes (mount proof).
    const a = await request(app).get('/api/identity/me');
    const b = await request(app).get('/api/v1/identity/me');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });

  it('marks legacy mounts deprecated', async () => {
    // GET /auth without a token → legacy getUser 401, still flagged.
    const res = await request(app).get('/auth');
    expect(res.status).toBe(401);
    expect(res.headers.deprecation).toBe('true');
  });

  it('does not flag versioned mounts deprecated', async () => {
    const res = await request(app).get('/api/v1/identity/me');
    expect(res.headers.deprecation).toBeUndefined();
  });
});

describe('error envelope (OBS-01)', () => {
  it('404s carry requestId', async () => {
    const res = await request(app).get('/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.requestId).toBe('string');
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('echoes caller-supplied request ids', async () => {
    const res = await request(app).get('/no-such-route').set('x-request-id', 'e2e-1');
    expect(res.body.requestId).toBe('e2e-1');
  });
});
