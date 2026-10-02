import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load as yamlLoad } from 'js-yaml';

// API-01: the spec must parse and cover every versioned mount + the
// security-relevant legacy surface (auth, transactions).

const doc = yamlLoad(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'openapi.yaml'), 'utf8')
);

describe('openapi.yaml', () => {
  it('is OpenAPI 3.x with servers and auth scheme', () => {
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.servers.length).toBeGreaterThan(0);
    expect(doc.components.securitySchemes.bearerAuth).toBeDefined();
    expect(doc.components.schemas.Error).toBeDefined();
  });

  it('covers all six /api/v1 mounts', () => {
    for (const m of ['talent-upload', 'youtube', 'user', 'posts', 'notifications', 'identity']) {
      const hit = Object.keys(doc.paths).some((p) => p.startsWith(`/api/v1/${m}`));
      expect(hit, m).toBe(true);
    }
  });

  it('covers every talent-upload route (10 ops incl. call-up)', () => {
    const ops = [];
    for (const [p, item] of Object.entries(doc.paths)) {
      if (!p.startsWith('/api/v1/talent-upload')) continue;
      for (const m of ['get', 'post', 'patch', 'put', 'delete']) if (item[m]) ops.push(`${m} ${p}`);
    }
    expect(ops.length).toBeGreaterThanOrEqual(10);
    expect(ops).toContain('post /api/v1/talent-upload/{id}/call-up');
  });

  it('documents youtube engagement writes (protect + cache note)', () => {
    for (const p of [
      '/api/v1/youtube/videos/{id}/like',
      '/api/v1/youtube/videos/{id}/dislike',
      '/api/v1/youtube/videos/{id}/comments',
    ]) {
      expect(doc.paths[p], p).toBeDefined();
      expect(doc.paths[p].post.security).toBeDefined();
    }
  });

  it('documents membership billing (plans → subscribe → verify/webhook)', () => {
    for (const p of [
      '/api/v1/membership/plans',
      '/api/v1/membership/subscribe',
      '/api/v1/membership/verify/{reference}',
      '/api/v1/membership/webhook',
      '/api/v1/membership/me',
    ]) {
      expect(doc.paths[p], p).toBeDefined();
    }
    expect(doc.paths['/api/v1/membership/subscribe'].post.security).toBeDefined();
  });

  it('documents SEC-03 payout containment (protect + min amount)', () => {
    const op = doc.paths['/transaction/withdraw-request'].post;
    expect(op.security).toBeDefined();
    expect(op.requestBody.content['application/json'].schema.properties.amount.minimum).toBe(100);
  });
});
