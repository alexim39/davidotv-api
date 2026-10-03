import { Router } from 'express';
import { protect } from '../../middleware/auth.js';
import * as svc from './orders.service.js';

const router = Router();

// Publishable key for Paystack Inline (pk_* is safe to expose; secrets never leave the server).
router.get('/paystack-key', protect, (_req, res) => {
  const key = process.env.PAYSTACK_PUBLIC_KEY;
  if (!key) return res.status(503).json({ success: false, message: 'Card payments not configured yet' });
  res.json({ success: true, data: { publicKey: key } });
});

// Server-side quote (member discount included) — call before Paystack.
router.post('/quote', protect, async (req, res, next) => {
  try {
    const { items, shippingMethod } = req.body;
    const quote = await svc.priceQuote({ userId: req.user._id, items, shippingMethod });
    res.json({ success: true, data: quote });
  } catch (e) { next(e); }
});

// Place a paid order (verified Paystack reference required).
router.post('/checkout', protect, async (req, res, next) => {
  try {
    const { items, shippingMethod, shippingAddress, paymentReference } = req.body;
    const { order, idempotent } = await svc.placeOrder({
      user: req.user, items, shippingMethod, shippingAddress, paymentReference,
    });
    res.status(idempotent ? 200 : 201).json({ success: true, data: order, idempotent });
  } catch (e) { next(e); }
});

router.get('/', protect, async (req, res, next) => {
  try {
    const result = await svc.listOrders(req.user._id, req.query);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const order = await svc.getOrder({ orderId: req.params.id, sessionUser: req.user });
    res.json({ success: true, data: order });
  } catch (e) { next(e); }
});

export default router;
