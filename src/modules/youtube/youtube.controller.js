import * as svc from './youtube.service.js';
import logger from '../../config/logger.js';
import youtubeConfig from '../../config/youtube.js';
import { buildCommentTree } from './comments.tree.js';
import { readRequestToken, verifyAuthToken } from '../../config/auth.js';
import { currentMembership } from '../membership/membership.service.js';

/** Optional session: exclusive videos need a member; public videos stay open. */
const optionalUser = async (req) => {
  try {
    const token = readRequestToken(req);
    if (!token) return null;
    const decoded = verifyAuthToken(token);
    const { UserModel } = await import('../../apps/user/models/user.model.js');
    return UserModel.findById(decoded.id).select('_id role').lean();
  } catch {
    return null; // bad/expired token → treated as anonymous, not a 401 here
  }
};

/**
 * Thin controller - delegates to service, handles HTTP.
 */
export const getVideos = async (req, res, next) => {
  try {
    const { menuType, isOfficialContent, isShort, limit, page, sort } = req.query;
    const result = await svc.getVideosCached({ menuType, isOfficialContent, isShort, limit, page, sort });
    res.json({ success: true, ...result, data: result.data.map(v=> ({ ...v, url: `https://www.youtube.com/watch?v=${v.youtubeVideoId}` })) });
  } catch (e) { logger.error('youtube/getVideos failed', { error: e.message }); next(e); }
};

export const getVideoById = async (req, res, next) => {
  try {
    const video = await svc.getVideoByIdCached(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    // Paywall: exclusive videos require an active paid tier. Public videos
    // keep the exact previous behavior (no session needed).
    if (video.isExclusive) {
      const user = await optionalUser(req);
      const tier = user ? (await currentMembership(user._id)).tier : 'free';
      if (tier === 'free') {
        return res.status(403).json({
          success: false,
          message: 'Members-only video — upgrade to watch.',
          upgradeRequired: true,
        });
      }
    }
    // Same nested comment shape as the legacy controller (FE renders
    // comment.user + comment.replies[]). Cache holds raw; tree built per serve.
    const data = {
      ...video,
      comments: buildCommentTree(video.comments || []),
      isOfficialContent: youtubeConfig.channelIds.includes(video.channelId),
      url: `https://www.youtube.com/watch?v=${video.youtubeVideoId}`,
    };
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

export const likeVideo = async (req, res, next) => {
  try {
    const r = await svc.toggleReaction({ videoId: req.params.id, userId: req.user._id, kind: 'like' });
    res.json({ success: true, message: r.liked ? 'Liked video' : 'Unliked video', ...r });
  } catch (e) { next(e); }
};

export const dislikeVideo = async (req, res, next) => {
  try {
    const r = await svc.toggleReaction({ videoId: req.params.id, userId: req.user._id, kind: 'dislike' });
    res.json({ success: true, message: r.disliked ? 'Disliked video' : 'Undisliked video', ...r });
  } catch (e) { next(e); }
};

export const addComment = async (req, res, next) => {
  try {
    const comment = await svc.addVideoComment({ videoId: req.params.id, userId: req.user._id, text: req.body?.text });
    res.status(201).json({ success: true, message: 'Comment added successfully', comment });
  } catch (e) { next(e); }
};

export const addReply = async (req, res, next) => {
  try {
    const reply = await svc.addVideoReply({
      videoId: req.params.id,
      parentCommentId: req.params.commentId,
      userId: req.user._id,
      text: req.body?.text,
    });
    res.status(201).json({ success: true, message: 'Reply added successfully', reply, videoId: req.params.id, parentCommentId: req.params.commentId });
  } catch (e) { next(e); }
};

export const likeComment = async (req, res, next) => {
  try {
    const r = await svc.likeVideoComment({ videoId: req.params.id, commentId: req.params.commentId, userId: req.user._id });
    res.json({ success: true, message: 'Your like has been added', ...r, videoId: req.params.id });
  } catch (e) { next(e); }
};

export const deleteComment = async (req, res, next) => {
  try {
    const r = await svc.deleteVideoComment({ videoId: req.params.id, commentId: req.params.commentId, sessionUser: req.user });
    res.json({ success: true, message: 'Comment and its replies deleted successfully.', ...r });
  } catch (e) { next(e); }
};

export const deleteReply = async (req, res, next) => {
  try {
    const r = await svc.deleteVideoReply({
      videoId: req.params.id,
      parentCommentId: req.params.parentId,
      replyId: req.params.replyId,
      sessionUser: req.user,
    });
    res.json({ success: true, message: 'Comment reply deleted successfully.', ...r });
  } catch (e) { next(e); }
};

export const getPlaylist = async (req, res, next) => {
  try {
    const { page, pageSize, menuType, sort, isOfficial } = req.query;
    const result = await svc.getPlaylistVideos({ page, pageSize, menuType, sort, isOfficial });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
};

export const searchVideos = async (req, res, next) => {
  try {
    const { search, limit, page, isOfficial } = req.query;
    if (!search?.trim()) return res.status(400).json({ success: false, message: 'Search query required' });
    const result = await svc.searchCached({ search, limit, page, isOfficial });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
};

export default { getVideos, getVideoById, searchVideos, likeVideo, dislikeVideo, addComment, addReply, likeComment, deleteComment, deleteReply, getPlaylist };
