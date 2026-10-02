import { YoutubeVideoModel } from '../../apps/youtube/models/youtube.model.js';
import mongoose from 'mongoose';
import logger from '../../config/logger.js';
import youtubeConfig from '../../config/youtube.js';

/**
 * Service layer for YouTube domain with in-memory cache.
 * BE serves cached MongoDB results; cron jobs refresh daily bypassing quota.
 * Cache TTL = 6h (mirrors FE 5min).
 */
const cache = new Map(); // key -> { data, total, ts }
const TTL = youtubeConfig.cacheTtlMs;

const keyFor = (params) => JSON.stringify(params);

export const getVideosCached = async ({ menuType, isOfficialContent, isShort, limit=12, page=0, sort='-publishedAt' }) => {
  const params = { menuType, isOfficialContent, isShort, limit, page, sort };
  const key = keyFor(params);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    logger.info('YouTube cache hit', { key });
    return hit.data;
  }

  // Build query matching legacy controller
  const officialIds = youtubeConfig.channelIds;
  let query = {};
  if (menuType === 'music') query = { isOfficialContent: true, channelId: { $in: officialIds } };
  else if (menuType === 'trending') query = { $or: [{ engagementScore: { $gt: 5000 } }, { shouldTrend: true }] };
  else if (menuType === 'videos') query = { isOfficialContent: false, channelId: { $nin: officialIds } };

  if (isOfficialContent === 'true') { query.isOfficialContent = true; query.channelId = { $in: officialIds }; }
  else if (isOfficialContent === 'false') { query.isOfficialContent = false; query.channelId = { $nin: officialIds }; }

  if (isShort === 'true') query.isShort = true;
  else if (isShort === 'false') query.isShort = false;

  const limitVal = Math.min(50, parseInt(limit) || 12);
  const skip = (parseInt(page) || 0) * limitVal;

  const [videos, total] = await Promise.all([
    YoutubeVideoModel.find(query).sort(sort).skip(skip).limit(limitVal).lean(),
    YoutubeVideoModel.countDocuments(query),
  ]);

  const result = { data: videos, total, page: parseInt(page), limit: limitVal };
  cache.set(key, { data: result, ts: Date.now() });
  // Prevent unbounded growth
  if (cache.size > 200) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  return result;
};

export const getVideoByIdCached = async (videoId) => {
  // Try cache for single
  const key = `video:${videoId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;

  const query = videoId.match(/^[0-9a-fA-F]{24}$/) ? { _id: videoId } : { youtubeVideoId: videoId };
  const video = await YoutubeVideoModel.findOneAndUpdate(query, { $inc: { appViews: 1 } }, { new: true })
    .populate({ path: 'comments.userId', select: 'username name lastname avatar' })
    .populate({ path: 'comments.likedBy', select: 'username avatar' })
    .lean();

  if (video) cache.set(key, { data: video, ts: Date.now() });
  return video;
};

export const searchCached = async ({ search, limit=12, page=0, isOfficial }) => {
  const key = `search:${search}:${limit}:${page}:${isOfficial}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < 60_000) return hit.data; // 1min for search

  const officialIds = youtubeConfig.channelIds;
  const trimmed = search.trim();
  const limitVal = parseInt(limit) || 12;
  const skip = parseInt(page) * limitVal;

  let baseQuery = { $text: { $search: trimmed } };
  if (isOfficial === 'true') baseQuery.channelId = { $in: officialIds };
  else if (isOfficial === 'false') baseQuery.channelId = { $nin: officialIds };

  let results = await YoutubeVideoModel.find(baseQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, publishedAt: -1 })
    .skip(skip)
    .limit(limitVal)
    .lean();

  if (results.length === 0) {
    const regex = new RegExp(trimmed.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    let fallback = { $or: [{ title: regex }, { description: regex }, { tags: regex }, { channel: regex }] };
    if (isOfficial === 'true') fallback.channelId = { $in: officialIds };
    else if (isOfficial === 'false') fallback.channelId = { $nin: officialIds };
    results = await YoutubeVideoModel.find(fallback).sort('-publishedAt').skip(skip).limit(limitVal).lean();
  }

  const total = await YoutubeVideoModel.countDocuments({ $or: [{ title: new RegExp(trimmed,'i') }, { description: new RegExp(trimmed,'i') }, { tags: new RegExp(trimmed,'i') }] });
  const payload = { data: results, meta: { query: trimmed, count: results.length, total, page: parseInt(page), limit: limitVal } };
  cache.set(key, { data: payload, ts: Date.now() });
  return payload;
};

export const clearCache = () => cache.clear();

/** Resolve by _id or youtubeVideoId WITHOUT touching appViews. */
const findVideo = (videoId) => {
  const query = /^[0-9a-fA-F]{24}$/.test(videoId) ? { _id: videoId } : { youtubeVideoId: videoId };
  return YoutubeVideoModel.findOne(query);
};

const toObjectId = (userId) =>
  mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

/**
 * Like/dislike toggle — ported from the legacy controller with one hardening:
 * the user comes from the session (protect), not the request body.
 * Returns the legacy response shape so FE needs no change.
 */
export const toggleReaction = async ({ videoId, userId, kind }) => {
  const video = await findVideo(videoId);
  if (!video) throw Object.assign(new Error('Video not found'), { statusCode: 404 });

  const uid = toObjectId(userId);
  const likedBy = video.appLikedBy || [];
  const dislikedBy = video.appDislikedBy || [];
  let liked = likedBy.some((id) => id.equals(uid));
  let disliked = dislikedBy.some((id) => id.equals(uid));

  if (kind === 'like') {
    if (liked) {
      video.appLikedBy.pull(uid);
      video.appLikes = Math.max(0, (video.appLikes || 0) - 1);
      liked = false;
    } else {
      video.appLikedBy.push(uid);
      video.appLikes = (video.appLikes || 0) + 1;
      liked = true;
      if (disliked) {
        video.appDislikedBy.pull(uid);
        video.appDislikes = Math.max(0, (video.appDislikes || 0) - 1);
        disliked = false;
      }
    }
  } else {
    if (disliked) {
      video.appDislikedBy.pull(uid);
      video.appDislikes = Math.max(0, (video.appDislikes || 0) - 1);
      disliked = false;
    } else {
      video.appDislikedBy.push(uid);
      video.appDislikes = (video.appDislikes || 0) + 1;
      disliked = true;
      if (liked) {
        video.appLikedBy.pull(uid);
        video.appLikes = Math.max(0, (video.appLikes || 0) - 1);
        liked = false;
      }
    }
  }

  await video.save();
  clearCache(); // likes must never serve stale
  return { liked, disliked, appLikes: video.appLikes, appDislikes: video.appDislikes };
};

/** Top-level comment — session user, model invariants preserved. */
export const addVideoComment = async ({ videoId, userId, text }) => {
  if (!text?.trim()) throw Object.assign(new Error('Comment text required'), { statusCode: 400 });
  const video = await findVideo(videoId);
  if (!video) throw Object.assign(new Error('Video not found'), { statusCode: 404 });
  await video.addComment(userId, text.trim().slice(0, 1000));
  clearCache();
  return video.comments[0];
};

/** Reply — same response keys as the legacy controller. */
export const addVideoReply = async ({ videoId, parentCommentId, userId, text }) => {
  if (!text?.trim()) throw Object.assign(new Error('Comment text required'), { statusCode: 400 });
  const video = await findVideo(videoId);
  if (!video) throw Object.assign(new Error('Video not found'), { statusCode: 404 });
  if (!video.comments.id(parentCommentId)) {
    throw Object.assign(new Error('Parent comment not found'), { statusCode: 404 });
  }
  await video.addReply(parentCommentId, userId, text.trim().slice(0, 1000));
  clearCache();
  const reply = video.comments[video.comments.length - 1];
  return {
    _id: reply._id,
    userId: reply.userId,
    text: reply.text,
    createdAt: reply.createdAt,
    parentCommentId: reply.parentComment,
  };
};

/** Comment/reply like — 400 on double-like (legacy semantics). */
export const likeVideoComment = async ({ videoId, commentId, userId }) => {
  const video = await findVideo(videoId);
  if (!video) throw Object.assign(new Error('Video not found'), { statusCode: 404 });
  const comment = video.comments.id(commentId);
  if (!comment) throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
  const uid = toObjectId(userId);
  if (comment.likedBy.some((id) => id.equals(uid))) {
    throw Object.assign(new Error('You already gave this a like'), { statusCode: 400 });
  }
  comment.likes += 1;
  comment.likedBy.push(uid);
  video.commentStats.totalLikes += 1;
  await video.save();
  clearCache();
  return { likes: comment.likes, commentId: comment._id };
};

const canModerate = (docUserId, sessionUser) =>
  docUserId.equals(sessionUser._id) || sessionUser.role === 'admin';

/** Delete comment + cascade replies (legacy cascade, session-enforced owner). */
export const deleteVideoComment = async ({ videoId, commentId, sessionUser }) => {
  const video = await findVideo(videoId);
  if (!video) throw Object.assign(new Error('Video not found'), { statusCode: 404 });
  const target = video.comments.id(commentId);
  if (!target) throw Object.assign(new Error('Comment not found'), { statusCode: 404 });
  if (!canModerate(target.userId, sessionUser)) {
    throw Object.assign(new Error('Not authorized to delete this comment.'), { statusCode: 403 });
  }
  const idsToRemove = [target._id];
  const queue = [...target.replies];
  while (queue.length > 0) {
    const cur = video.comments.id(queue.shift());
    if (cur) {
      idsToRemove.push(cur._id);
      if (cur.replies?.length) queue.push(...cur.replies);
    }
  }
  video.comments = video.comments.filter((c) => !idsToRemove.some((id) => id.equals(c._id)));
  await video.save();
  clearCache();
  return { commentId: target._id };
};

/** Delete a single reply (owner or admin, association-checked). */
export const deleteVideoReply = async ({ videoId, parentCommentId, replyId, sessionUser }) => {
  const video = await findVideo(videoId);
  if (!video) throw Object.assign(new Error('Video not found'), { statusCode: 404 });
  const parent = video.comments.id(parentCommentId);
  if (!parent) throw Object.assign(new Error('Parent comment not found'), { statusCode: 404 });
  const reply = video.comments.id(replyId);
  if (!reply) throw Object.assign(new Error('Reply not found'), { statusCode: 404 });
  if (!reply.parentComment || !reply.parentComment.equals(parentCommentId)) {
    throw Object.assign(new Error('Invalid reply or parent comment association.'), { statusCode: 400 });
  }
  if (!canModerate(reply.userId, sessionUser)) {
    throw Object.assign(new Error('Not authorized to delete this reply.'), { statusCode: 403 });
  }
  parent.replies = parent.replies.filter((rId) => !rId.equals(replyId));
  video.comments = video.comments.filter((c) => !c._id.equals(replyId));
  await video.save();
  clearCache();
  return { replyId: reply._id };
};

/** Playlist reads — ported query semantics (menuType/sort/official/paged). */
export const getPlaylistVideos = async ({ page = 1, pageSize = 10, menuType, sort = '-publishedAt', isOfficial } = {}) => {
  const officialIds = youtubeConfig.channelIds;
  const pageNum = Math.max(parseInt(page) || 1, 1);
  const pageSizeNum = Math.min(Math.max(parseInt(pageSize) || 10, 1), 50);

  const filter = menuType ? { menuTypes: menuType } : {};
  if (isOfficial === 'true') filter.channelId = { $in: officialIds };
  else if (isOfficial === 'false') filter.channelId = { $nin: officialIds };

  const sortOption =
    sort === 'views' ? { views: -1 } :
    sort === 'engagementScore' ? { engagementScore: -1 } :
    { publishedAt: -1 };

  const totalCount = await YoutubeVideoModel.countDocuments(filter);
  const totalPages = Math.ceil(totalCount / pageSizeNum);
  const videos = await YoutubeVideoModel.find(filter)
    .sort(sortOption)
    .skip((pageNum - 1) * pageSizeNum)
    .limit(pageSizeNum)
    .lean();

  return {
    data: videos.map((v) => ({
      ...v,
      isOfficialContent: officialIds.includes(v.channelId),
    })),
    pagination: {
      currentPage: pageNum,
      pageSize: pageSizeNum,
      totalPages,
      totalCount,
      hasNextPage: pageNum < totalPages,
    },
  };
};

export default { getVideosCached, getVideoByIdCached, searchCached, clearCache, toggleReaction, addVideoComment, addVideoReply, likeVideoComment, deleteVideoComment, deleteVideoReply, getPlaylistVideos };
