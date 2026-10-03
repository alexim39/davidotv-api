import { Router } from 'express';
import { protect } from '../../middleware/auth.js';
import { uploadMedia } from '../../middleware/upload.js';
import * as ctrl from './post.controller.js';

const router = Router();

router.get('/', ctrl.getPosts);
router.post('/', protect, uploadMedia.single('media'), ctrl.createPost);
router.post('/:id/like', protect, ctrl.likePost);

export default router;
