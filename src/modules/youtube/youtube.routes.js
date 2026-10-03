import { Router } from 'express';
import { apiLimiter } from '../../middleware/rateLimiter.js';
import { protect, authorize } from '../../middleware/auth.js';
import * as ctrl from './youtube.controller.js';

const router = Router();

router.use(apiLimiter);

router.get('/videos', ctrl.getVideos);
router.get('/videos/search', ctrl.searchVideos);
router.get('/videos/playlist', ctrl.getPlaylist);
router.get('/videos/:id', ctrl.getVideoById);

// Engagement writes (ported from legacy; session user, cache-invalidated).
// Declared after the GETs so no POST path collides with GET /videos/:id.
router.post('/videos/:id/like', protect, ctrl.likeVideo);
router.post('/videos/:id/dislike', protect, ctrl.dislikeVideo);
router.post('/videos/:id/comments', protect, ctrl.addComment);
router.post('/videos/:id/comments/:commentId/replies', protect, ctrl.addReply);
router.post('/videos/:id/comments/:commentId/like', protect, ctrl.likeComment);
router.delete('/videos/:id/comments/:commentId', protect, ctrl.deleteComment);
router.delete('/videos/:id/comments/:parentId/replies/:replyId', protect, ctrl.deleteReply);

// Admin console: paywall flag (clears the read cache on change).
router.patch('/videos/:id/exclusive', protect, authorize('admin'), ctrl.setExclusive);

export default router;
