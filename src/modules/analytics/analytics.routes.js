import { Router } from 'express';
import { protect, authorize } from '../../middleware/auth.js';
import * as svc from './analytics.service.js';

const router = Router();

// Ingestion: authenticated fans only (WEF counts authenticated users).
router.post('/events', protect, async (req, res, next) => {
  try {
    const { type, refId, meta } = req.body;
    const doc = await svc.track({ userId: req.user._id, type, refId, meta });
    res.status(201).json({ success: true, data: { id: doc._id, type: doc.type } });
  } catch (e) { next(e); }
});

// North-star readout: admin only.
router.get('/wef', protect, authorize('admin'), async (req, res, next) => {
  try {
    const windowDays = Math.min(30, Math.max(1, parseInt(req.query.windowDays) || 7));
    const result = await svc.computeWef({ windowDays });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
});

export default router;
