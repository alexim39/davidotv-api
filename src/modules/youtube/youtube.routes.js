import { Router } from 'express';
import { apiLimiter } from '../../middleware/rateLimiter.js';
import { protect } from '../../middleware/auth.js';
import * as ctrl from './youtube.controller.js';

const router = Router();

router.use(apiLimiter);

router.get('/videos', ctrl.getVideos);
router.get('/videos/search', ctrl.searchVideos);
router.get('/videos/:id', ctrl.getVideoById);

// Engagement writes (ported from legacy; session user, cache-invalidated).
// Declared after the GETs so no POST path collides with GET /videos/:id.
router.post('/videos/:id/like', protect, ctrl.likeVideo);
router.post('/videos/:id/dislike', protect, ctrl.dislikeVideo);
router.post('/videos/:id/comments', protect, ctrl.addComment);

export default router;
