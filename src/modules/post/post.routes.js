import { Router } from 'express';
import { protect } from '../../middleware/auth.js';
import { uploadTalent } from '../../middleware/upload.js';
import * as ctrl from './post.controller.js';

const router = Router();

router.get('/', ctrl.getPosts);
router.post('/', protect, uploadTalent.single('media'), ctrl.createPost);
router.post('/:id/like', protect, ctrl.likePost);

export default router;
