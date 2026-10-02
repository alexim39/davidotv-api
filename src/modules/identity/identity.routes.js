import { Router } from 'express';
import { protect } from '../../middleware/auth.js';

const router = Router();

/**
 * SEC-02 single identity contract.
 * GET /api/identity/me → { success, data } (new shape).
 * Legacy GET /auth → { success, user } kept for compat.
 */
router.get('/me', protect, async (req, res, next) => {
  try {
    res.json({ success: true, data: req.user });
  } catch (e) { next(e); }
});

export default router;
