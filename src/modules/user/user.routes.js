import { Router } from 'express';
import { protect } from '../../middleware/auth.js';
import { uploadAvatar } from '../../middleware/upload.js';
import * as ctrl from './user.controller.js';

const router = Router();

router.get('/me', protect, ctrl.me);
router.put('/profile', protect, ctrl.updateProfile);
router.post('/avatar', protect, uploadAvatar.single('avatar'), ctrl.uploadAvatar);

export default router;
