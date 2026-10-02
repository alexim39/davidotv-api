import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, clearTestDB, closeTestDB } from '../../test/db.js';
import { UserModel } from '../../apps/user/models/user.model.js';
import { YoutubeVideoModel } from '../../apps/youtube/models/youtube.model.js';
import { signAuthToken } from '../../config/auth.js';
import { clearCache } from './youtube.service.js';
import { createApp } from '../../../server.js';

// Ported-engagement parity: like/dislike/comment/tree/cache on the new module.

const OLD_SECRET = process.env.JWT_SECRET;
let app;
let user;
let token;
let video;

const mkUser = (u) => UserModel.create({
  username: u, name: 'T', lastname: 'U', email: `${u}@testmail.com`,
  password: 'x'.repeat(12),
});

const mkVideo = () => YoutubeVideoModel.create({
  youtubeVideoId: 'yt-engage-1',
  title: 'Engagement Test Video',
  channel: 'Fan Channel',
  channelId: 'UCfan123',
  publishedAt: new Date(),
  thumbnail: { default: 'http://img/d.jpg' },
});

beforeAll(async () => {
  process.env.JWT_SECRET = 'yt-test-secret';
  await connectTestDB();
  app = createApp();
});

afterAll(async () => {
  process.env.JWT_SECRET = OLD_SECRET;
  await closeTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  clearCache();
  user = await mkUser('ytfan');
  token = signAuthToken(user._id);
  video = await mkVideo();
});

const auth = (req) => req.set('Authorization', `Bearer ${token}`);

describe('like / dislike toggle', () => {
  it('likes, unlikes, and dislikes with legacy response shape', async () => {
    const like1 = await auth(request(app).post('/api/v1/youtube/videos/yt-engage-1/like'));
    expect(like1.status).toBe(200);
    expect(like1.body).toMatchObject({ liked: true, appLikes: 1 });

    const like2 = await auth(request(app).post('/api/v1/youtube/videos/yt-engage-1/like'));
    expect(like2.body).toMatchObject({ liked: false, appLikes: 0 });

    const dis = await auth(request(app).post('/api/v1/youtube/videos/yt-engage-1/dislike'));
    expect(dis.body).toMatchObject({ disliked: true, appDislikes: 1 });
  });

  it('dislike removes a prior like', async () => {
    await auth(request(app).post('/api/v1/youtube/videos/yt-engage-1/like'));
    const dis = await auth(request(app).post('/api/v1/youtube/videos/yt-engage-1/dislike'));
    expect(dis.body).toMatchObject({ liked: false, disliked: true, appLikes: 0, appDislikes: 1 });
  });

  it('401s anonymously and 404s unknown videos', async () => {
    expect((await request(app).post('/api/v1/youtube/videos/yt-engage-1/like')).status).toBe(401);
    const missing = await auth(request(app).post('/api/v1/youtube/videos/nope/like'));
    expect(missing.status).toBe(404);
  });

  it('invalidates the read cache (no stale counts)', async () => {
    const before = await request(app).get('/api/v1/youtube/videos/yt-engage-1');
    expect(before.body.data.appLikes || 0).toBe(0);
    await auth(request(app).post('/api/v1/youtube/videos/yt-engage-1/like'));
    const after = await request(app).get('/api/v1/youtube/videos/yt-engage-1');
    expect(after.body.data.appLikes).toBe(1);
  });
});

describe('comments', () => {
  it('adds a top-level comment (201) and serves the nested tree', async () => {
    const add = await auth(request(app).post('/api/v1/youtube/videos/yt-engage-1/comments'))
      .send({ text: 'Great track' });
    expect(add.status).toBe(201);

    const doc = await YoutubeVideoModel.findById(video._id);
    await doc.addReply(doc.comments[0]._id, user._id, 'Agreed');

    const get = await request(app).get('/api/v1/youtube/videos/yt-engage-1');
    const [top] = get.body.data.comments;
    expect(top.text).toBe('Great track');
    expect(top.user.username).toBe('ytfan');
    expect(top.replies).toHaveLength(1);
    expect(top.replies[0].text).toBe('Agreed');
  });

  it('400s empty comment text', async () => {
    const res = await auth(request(app).post('/api/v1/youtube/videos/yt-engage-1/comments'))
      .send({ text: '   ' });
    expect(res.status).toBe(400);
  });
});

describe('list shape parity', () => {
  it('serves {success,data[],total} for the videos menu', async () => {
    const res = await request(app).get('/api/v1/youtube/videos?menuType=videos&limit=12&page=0');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBe(1);
  });
});
