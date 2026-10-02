import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectTestDB, clearTestDB, closeTestDB } from '../../test/db.js';
import { UserModel } from '../../apps/user/models/user.model.js';
import { TalentUploadModel } from './talent.model.js';
import { NotificationModel } from '../notification/notification.service.js';
import { triggerCallUp } from './talent.service.js';

// P2: Call-Up fan-out. SMTP/FCM unconfigured here — push+email skip safely,
// the in-app Notification must still persist (the bell always works).

let admin;
let fan;

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await closeTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  admin = await UserModel.create({
    username: 'aandrzea', name: 'A', lastname: 'R', email: 'ar@testmail.com',
    password: 'x'.repeat(12), role: 'admin',
  });
  fan = await UserModel.create({
    username: 'fanone', name: 'Fan', lastname: 'One', email: 'fan@testmail.com',
    password: 'x'.repeat(12),
  });
});

const makeUpload = () => TalentUploadModel.create({
  artistName: 'Test Artist',
  title: 'Test Track',
  genre: 'Afrobeats',
  fileUrl: '/uploads/talent/2026-01/f.mp3',
  mimeType: 'audio/mpeg',
  fileSize: 1024,
  uploader: fan._id,
});

describe('triggerCallUp fan-out', () => {
  it('marks called_up and persists a CALL_UP notification for the uploader', async () => {
    const up = await makeUpload();
    const doc = await triggerCallUp({ id: up._id, adminUser: admin });

    expect(doc.callUpStatus).toBe('called_up');
    const notes = await NotificationModel.find({ recipient: fan._id }).lean();
    expect(notes).toHaveLength(1);
    expect(notes[0].type).toBe('CALL_UP');
    expect(notes[0].actor.toString()).toBe(admin._id.toString());
    expect(notes[0].read).toBe(false);
  });

  it('is idempotent — repeat calls create no duplicate notification', async () => {
    const up = await makeUpload();
    await triggerCallUp({ id: up._id, adminUser: admin });
    await triggerCallUp({ id: up._id, adminUser: admin });
    const count = await NotificationModel.countDocuments({ recipient: fan._id });
    expect(count).toBe(1);
  });

  it('404s on unknown upload', async () => {
    await expect(
      triggerCallUp({ id: '64b64c9a1a2b3c4d5e6f0001', adminUser: admin })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
