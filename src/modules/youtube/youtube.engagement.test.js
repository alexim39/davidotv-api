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

describe('reply / comment-like / delete', () => {
  it('replies, likes, and deletes with owner enforcement', async () => {
    const add = await auth(request(app).post('/api/v1/youtube/videos/yt-engage-1/comments'))
      .send({ text: 'Top' });
    const commentId = add.body.comment._id;

    const reply = await auth(request(app).post(`/api/v1/youtube/videos/yt-engage-1/comments/${commentId}/replies`))
      .send({ text: 'Reply!' });
    expect(reply.status).toBe(201);
    expect(reply.body.reply.parentCommentId).toBe(commentId);

    const like = await auth(request(app).post(`/api/v1/youtube/videos/yt-engage-1/comments/${commentId}/like`));
    expect(like.body).toMatchObject({ likes: 1 });

    const likeAgain = await auth(request(app).post(`/api/v1/youtube/videos/yt-engage-1/comments/${commentId}/like`));
    expect(likeAgain.status).toBe(400);

    const delReply = await auth(request(app).delete(`/api/v1/youtube/videos/yt-engage-1/comments/${commentId}/replies/${reply.body.reply._id}`));
    expect(delReply.status).toBe(200);

    const del = await auth(request(app).delete(`/api/v1/youtube/videos/yt-engage-1/comments/${commentId}`));
    expect(del.body.commentId).toBe(commentId);
  });

  it('403s deletes by non-owners', async () => {
    const other = await UserModel.create({
      username: 'other', name: 'O', lastname: 'T', email: 'other@testmail.com',
      password: 'x'.repeat(12),
    });
    const add = await auth(request(app).post('/api/v1/youtube/videos/yt-engage-1/comments'))
      .send({ text: 'Mine' });
    const otherToken = (await import('../../config/auth.js')).signAuthToken(other._id);
    const del = await request(app).delete(`/api/v1/youtube/videos/yt-engage-1/comments/${add.body.comment._id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(del.status).toBe(403);
  });
});

describe('playlist reads', () => {
  it('serves paginated playlist shape', async () => {
    const res = await request(app).get('/api/v1/youtube/videos/playlist?page=1&pageSize=10');
    expect(res.status).toBe(200);
    expect(res.body.pagination.totalCount).toBe(1);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('exclusive paywall', () => {
  it('403s anonymous and free-tier viewers with upgradeRequired', async () => {
    await YoutubeVideoModel.findByIdAndUpdate(video._id, { isExclusive: true });
    clearCache();

    const anon = await request(app).get('/api/v1/youtube/videos/yt-engage-1');
    expect(anon.status).toBe(403);
    expect(anon.body.upgradeRequired).toBe(true);

    const free = await auth(request(app).get('/api/v1/youtube/videos/yt-engage-1'));
    expect(free.status).toBe(403);
    expect(free.body.upgradeRequired).toBe(true);
  });

  it('serves members and leaves public videos open', async () => {
    await YoutubeVideoModel.findByIdAndUpdate(video._id, { isExclusive: true });
    clearCache();

    const member = await UserModel.create({
      username: 'member', name: 'M', lastname: 'T', email: 'member@testmail.com',
      password: 'x'.repeat(12),
    });
    const now = new Date();
    const { MembershipModel } = await import('../membership/membership.model.js');
    await MembershipModel.create({
      user: member._id, tier: 'fan_monthly', status: 'active', amountNgn: 900,
      currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86400000),
    });
    const { signAuthToken: sign } = await import('../../config/auth.js');
    const res = await request(app).get('/api/v1/youtube/videos/yt-engage-1')
      .set('Authorization', `Bearer ${sign(member._id)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.youtubeVideoId).toBe('yt-engage-1');

    await YoutubeVideoModel.findByIdAndUpdate(video._id, { isExclusive: false });
    clearCache();
    const pub = await request(app).get('/api/v1/youtube/videos/yt-engage-1');
    expect(pub.status).toBe(200);
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
