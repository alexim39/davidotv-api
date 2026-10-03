import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, clearTestDB, closeTestDB } from '../../test/db.js';
import { UserModel } from '../../apps/user/models/user.model.js';
import { TalentUploadModel } from '../talent-upload/talent.model.js';
import { signAuthToken } from '../../config/auth.js';
import { createApp } from '../../../server.js';

// Challenge lifecycle: create → activate → enter (own uploads) → winner.

const OLD_SECRET = process.env.JWT_SECRET;
let app;
let admin;
let fan;
let other;
let adminToken;
let fanToken;
let upload;

const mkUser = (u, extra = {}) => UserModel.create({
  username: u, name: 'T', lastname: 'U', email: `${u}@testmail.com`,
  password: 'x'.repeat(12), ...extra,
});

const window_ = () => {
  const now = new Date();
  return { startsAt: now.toISOString(), endsAt: new Date(now.getTime() + 7 * 86400000).toISOString() };
};

beforeAll(async () => {
  process.env.JWT_SECRET = 'challenges-test-secret';
  await connectTestDB();
  app = createApp();
});

afterAll(async () => {
  process.env.JWT_SECRET = OLD_SECRET;
  await closeTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  admin = await mkUser('chadmin', { role: 'admin' });
  fan = await mkUser('chfan');
  other = await mkUser('chother');
  adminToken = signAuthToken(admin._id);
  fanToken = signAuthToken(fan._id);
  upload = await TalentUploadModel.create({
    artistName: 'A', title: 'T', genre: 'Afrobeats',
    fileUrl: '/uploads/talent/2026-01/f.mp3', mimeType: 'audio/mpeg',
    fileSize: 1, uploader: fan._id,
  });
});

const asAdmin = (r) => r.set('Authorization', `Bearer ${adminToken}`);
const asFan = (r) => r.set('Authorization', `Bearer ${fanToken}`);

describe('lifecycle', () => {
  it('creates (admin), lists publicly, and validates the window', async () => {
    const bad = await asAdmin(request(app).post('/api/v1/challenges')).send({ title: 'X' });
    expect(bad.status).toBe(400);

    const created = await asAdmin(request(app).post('/api/v1/challenges'))
      .send({ title: 'Dance Challenge', ...window_() });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('draft');

    const fanCreate = await asFan(request(app).post('/api/v1/challenges')).send({ title: 'X', ...window_() });
    expect(fanCreate.status).toBe(403);

    const list = await request(app).get('/api/v1/challenges?status=draft');
    expect(list.body.total).toBe(1);
  });

  it('enters own uploads while active, rejects others/duplicates/closed', async () => {
    const { body: { data: ch } } = await asAdmin(request(app).post('/api/v1/challenges'))
      .send({ title: 'Cover Contest', ...window_() });
    await asAdmin(request(app).patch(`/api/v1/challenges/${ch._id}/status`)).send({ status: 'active' });

    const enter = await asFan(request(app).post(`/api/v1/challenges/${ch._id}/entries`))
      .send({ uploadId: String(upload._id) });
    expect(enter.status).toBe(201);

    const dup = await asFan(request(app).post(`/api/v1/challenges/${ch._id}/entries`))
      .send({ uploadId: String(upload._id) });
    expect(dup.status).toBe(409);

    const otherToken = signAuthToken(other._id);
    const foreign = await request(app).post(`/api/v1/challenges/${ch._id}/entries`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ uploadId: String(upload._id) });
    expect(foreign.status).toBe(403);
  });

  it('declares an entered winner and closes the challenge', async () => {
    const { body: { data: ch } } = await asAdmin(request(app).post('/api/v1/challenges'))
      .send({ title: 'Remix Battle', ...window_() });
    await asAdmin(request(app).patch(`/api/v1/challenges/${ch._id}/status`)).send({ status: 'active' });
    await asFan(request(app).post(`/api/v1/challenges/${ch._id}/entries`))
      .send({ uploadId: String(upload._id) });

    const outsider = await TalentUploadModel.create({
      artistName: 'O', title: 'OT', genre: 'Afrobeats',
      fileUrl: '/uploads/talent/2026-01/o.mp3', mimeType: 'audio/mpeg',
      fileSize: 1, uploader: other._id,
    });
    const badWinner = await asAdmin(request(app).post(`/api/v1/challenges/${ch._id}/winner`))
      .send({ uploadId: String(outsider._id) });
    expect(badWinner.status).toBe(400);

    const win = await asAdmin(request(app).post(`/api/v1/challenges/${ch._id}/winner`))
      .send({ uploadId: String(upload._id) });
    expect(win.status).toBe(200);
    expect(win.body.data.status).toBe('closed');
    expect(String(win.body.data.winnerUpload)).toBe(String(upload._id));
  });
});
