import { Router } from 'express';
import { protect, authorize } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/rateLimiter.js';
import { uploadTalent } from '../../middleware/upload.js';
import * as ctrl from './talent.controller.js';

const router = Router();

// Public feed (ranked by engagement)
router.get('/', ctrl.listTalent);
router.get('/curated', protect, authorize('admin'), ctrl.getCurated);
router.get('/:id', ctrl.getTalentById);

// Authenticated actions
router.post('/', protect, uploadLimiter, uploadTalent.single('file'), ctrl.uploadTalent);
router.post('/:id/play', ctrl.playTalent); // allow anonymous play tracking
router.post('/:id/like', protect, ctrl.likeTalent);
router.post('/:id/share', protect, ctrl.shareTalent);
router.post('/:id/comments', protect, ctrl.addComment);

// Admin Call-Up protocol
router.post('/:id/call-up', protect, authorize('admin'), ctrl.callUp);
router.post('/:id/flag', protect, authorize('admin'), ctrl.flag);

export default router;
