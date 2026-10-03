import { Router } from 'express';
import { protect, authorize } from '../../middleware/auth.js';
import * as svc from './challenges.service.js';

const router = Router();

// Public board.
router.get('/', async (req, res, next) => {
  try {
    const result = await svc.listChallenges(req.query);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
});

// Admin: create + status transitions.
router.post('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const doc = await svc.createChallenge(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (e) { next(e); }
});

router.patch('/:id/status', protect, authorize('admin'), async (req, res, next) => {
  try {
    const doc = await svc.setStatus({ id: req.params.id, status: req.body?.status });
    res.json({ success: true, data: doc });
  } catch (e) { next(e); }
});

// Entry: own uploads only (admins exempt).
router.post('/:id/entries', protect, async (req, res, next) => {
  try {
    const doc = await svc.enterChallenge({ id: req.params.id, uploadId: req.body?.uploadId, sessionUser: req.user });
    res.status(201).json({ success: true, data: doc });
  } catch (e) { next(e); }
});

// Winner: admin, must be an entered upload.
router.post('/:id/winner', protect, authorize('admin'), async (req, res, next) => {
  try {
    const doc = await svc.decideWinner({ id: req.params.id, uploadId: req.body?.uploadId, adminUser: req.user });
    res.json({ success: true, data: doc });
  } catch (e) { next(e); }
});

export default router;
