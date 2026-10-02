import { Router } from 'express';
import { protect, authorize } from '../../middleware/auth.js';
import * as svc from './membership.service.js';

const router = Router();

// Public catalog (prices are public by design).
router.get('/plans', (_req, res) => {
  res.json({ success: true, data: svc.listPlans() });
});

// Start checkout → Paystack authorization URL.
router.post('/subscribe', protect, async (req, res, next) => {
  try {
    const result = await svc.startSubscription({ user: req.user, tier: req.body?.tier });
    res.status(201).json({ success: true, ...result });
  } catch (e) { next(e); }
});

// Return from Paystack: verify + activate (idempotent).
router.get('/verify/:reference', protect, async (req, res, next) => {
  try {
    const membership = await svc.verifySubscription(req.params.reference);
    res.json({ success: true, data: membership });
  } catch (e) { next(e); }
});

// Paystack webhook — raw body + HMAC (mounted with express.raw in server.js).
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    if (!svc.verifyWebhookSignature(req.body, signature)) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }
    const event = JSON.parse(req.body.toString());
    if (event?.event === 'charge.success') {
      try {
        await svc.activateFromReference(event.data.reference, event.data);
      } catch (e) {
        // Unknown refs fail closed but ack the webhook (Paystack retries).
        return res.json({ success: true, note: 'reference ignored' });
      }
    }
    res.json({ success: true });
  } catch (e) { next(e); }
});

// Own effective membership + entitlements.
router.get('/me', protect, async (req, res, next) => {
  try {
    res.json({ success: true, data: await svc.currentMembership(req.user._id) });
  } catch (e) { next(e); }
});

// Cancel (benefits run to period end).
router.post('/cancel', protect, async (req, res, next) => {
  try {
    const membership = await svc.cancelSubscription(req.user._id);
    res.json({ success: true, data: membership });
  } catch (e) { next(e); }
});

// Admin readout (dashboard seed).
router.get('/overview', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { MembershipModel } = await import('./membership.model.js');
    const [active, pending] = await Promise.all([
      MembershipModel.countDocuments({ status: 'active' }),
      MembershipModel.countDocuments({ status: 'pending' }),
    ]);
    res.json({ success: true, data: { active, pending } });
  } catch (e) { next(e); }
});

export default router;
