import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, clearTestDB, closeTestDB } from '../../test/db.js';
import { UserModel } from '../../apps/user/models/user.model.js';
import { TalentUploadModel } from '../talent-upload/talent.model.js';
import { NotificationModel } from './notification.service.js';
import { signAuthToken } from '../../config/auth.js';
import { getPreferences, updatePreferences, shouldSend } from './notification.service.js';
import { triggerCallUp } from '../talent-upload/talent.service.js';
import { createApp } from '../../../server.js';

// NOT-01: channel/type preferences with Call-Up gating. In-app always wins.

const OLD_SECRET = process.env.JWT_SECRET;
let app;
let admin;
let fan;
let fanToken;

const mkUser = (u, extra = {}) => UserModel.create({
  username: u, name: 'T', lastname: 'U', email: `${u}@testmail.com`,
  password: 'x'.repeat(12), ...extra,
});

beforeAll(async () => {
  process.env.JWT_SECRET = 'prefs-test-secret';
  await connectTestDB();
  app = createApp();
});

afterAll(async () => {
  process.env.JWT_SECRET = OLD_SECRET;
  await closeTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  admin = await mkUser('prefsadmin', { role: 'admin' });
  fan = await mkUser('prefsfan');
  fanToken = signAuthToken(fan._id);
});

describe('preferences CRUD', () => {
  it('upserts on-by-default preferences', async () => {
    const p = await getPreferences(fan._id);
    expect(p.push).toBe(true);
    expect(p.email).toBe(true);
    expect(p.mutedTypes).toEqual([]);
  });

  it('whitelists fields and drops unknown muted types', async () => {
    const p = await updatePreferences(fan._id, {
      push: false, email: true, mutedTypes: ['LIKE', 'BOGUS'], admin: true,
    });
    expect(p.push).toBe(false);
    expect(p.email).toBe(true);
    expect(p.mutedTypes).toEqual(['LIKE']);
    expect(p.admin).toBeUndefined();
  });

  it('gates channels, never the bell', async () => {
    expect(await shouldSend(fan._id, 'CALL_UP', 'inApp')).toBe(true);
    expect(await shouldSend(fan._id, 'CALL_UP', 'push')).toBe(true);
    expect(await shouldSend(fan._id, 'CALL_UP', 'sms')).toBe(false);
    await updatePreferences(fan._id, { push: false, mutedTypes: ['LIKE'] });
    expect(await shouldSend(fan._id, 'CALL_UP', 'push')).toBe(false);
    expect(await shouldSend(fan._id, 'CALL_UP', 'email')).toBe(true);
    expect(await shouldSend(fan._id, 'LIKE', 'email')).toBe(false);
    expect(await shouldSend(fan._id, 'CALL_UP', 'inApp')).toBe(true);
  });
});

describe('preferences routes', () => {
  it('GET/PUT round-trip for the owner, 401 anonymously', async () => {
    const anon = await request(app).get('/api/v1/notifications/preferences');
    expect(anon.status).toBe(401);

    const put = await request(app).put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${fanToken}`)
      .send({ email: false });
    expect(put.status).toBe(200);
    expect(put.body.data.email).toBe(false);

    const get = await request(app).get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${fanToken}`);
    expect(get.body.data.email).toBe(false);
  });
});

describe('Call-Up respects prefs', () => {
  it('still creates the in-app notification when push+email are muted', async () => {
    await updatePreferences(fan._id, { push: false, email: false });
    const up = await TalentUploadModel.create({
      artistName: 'A', title: 'T', genre: 'Afrobeats',
      fileUrl: '/uploads/talent/2026-01/f.mp3', mimeType: 'audio/mpeg',
      fileSize: 1, uploader: fan._id,
    });
    await triggerCallUp({ id: up._id, adminUser: admin });
    const notes = await NotificationModel.find({ recipient: fan._id });
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe('CALL_UP');
  });
});
