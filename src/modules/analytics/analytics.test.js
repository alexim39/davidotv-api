import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, clearTestDB, closeTestDB } from '../../test/db.js';
import { UserModel } from '../../apps/user/models/user.model.js';
import { signAuthToken } from '../../config/auth.js';
import { track, computeWef, WEF_CONFIG } from './analytics.service.js';
import { createApp } from '../../../server.js';

// WEF-01: ingestion validation + north-star computation.

const OLD_SECRET = process.env.JWT_SECRET;
let app;
let admin;
let fanA;
let fanB;
let fanC;
let adminToken;
let fanAToken;

const mkUser = (u, extra = {}) => UserModel.create({
  username: u, name: 'T', lastname: 'U', email: `${u}@testmail.com`,
  password: 'x'.repeat(12), ...extra,
});

beforeAll(async () => {
  process.env.JWT_SECRET = 'wef-test-secret';
  await connectTestDB();
  app = createApp();
});

afterAll(async () => {
  process.env.JWT_SECRET = OLD_SECRET;
  await closeTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  admin = await mkUser('wefadmin', { role: 'admin' });
  fanA = await mkUser('weffana');
  fanB = await mkUser('weffanb');
  fanC = await mkUser('weffanc');
  adminToken = signAuthToken(admin._id);
  fanAToken = signAuthToken(fanA._id);
});

describe('track validation', () => {
  it('rejects unknown event types with 400', async () => {
    await expect(track({ userId: fanA._id, type: 'bogus' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('POST /events requires a session', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/events')
      .send({ type: 'like', refId: 'x' });
    expect(res.status).toBe(401);
  });

  it('POST /events persists a valid event', async () => {
    const res = await request(app)
      .post('/api/v1/analytics/events')
      .set('Authorization', `Bearer ${fanAToken}`)
      .send({ type: 'video_watch', refId: 'vid1' });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('video_watch');
  });
});

describe('computeWef', () => {
  it('counts only fans with consumption AND participation inside the window', async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 30 * 86400000);
    // A: both, recent → counts
    await track({ userId: fanA._id, type: 'video_watch', at: now });
    await track({ userId: fanA._id, type: 'like', at: now });
    // B: consumption only → excluded
    await track({ userId: fanB._id, type: 'video_watch', at: now });
    await track({ userId: fanB._id, type: 'talent_view', at: now });
    // C: both, but stale → excluded
    await track({ userId: fanC._id, type: 'video_watch', at: old });
    await track({ userId: fanC._id, type: 'comment', at: old });

    const { wef, windowDays } = await computeWef({ now });
    expect(wef).toBe(1);
    expect(windowDays).toBe(WEF_CONFIG.windowDays);
  });

  it('GET /wef is admin-only', async () => {
    const anon = await request(app).get('/api/v1/analytics/wef');
    expect(anon.status).toBe(401);
    const fan = await request(app).get('/api/v1/analytics/wef')
      .set('Authorization', `Bearer ${fanAToken}`);
    expect(fan.status).toBe(403);
    const adm = await request(app).get('/api/v1/analytics/wef')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adm.status).toBe(200);
    expect(adm.body.wef).toBe(0);
  });
});
