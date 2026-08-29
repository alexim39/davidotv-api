import { Router } from 'express';
import { apiLimiter } from '../../middleware/rateLimiter.js';
import * as ctrl from './youtube.controller.js';

const router = Router();

router.use(apiLimiter);

router.get('/videos', ctrl.getVideos);
router.get('/videos/search', ctrl.searchVideos);
router.get('/videos/:id', ctrl.getVideoById);

export default router;
