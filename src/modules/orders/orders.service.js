import crypto from 'crypto';
import { OrderModel } from '../../apps/store/models/order.model.js';
import { ProductModel } from '../../apps/store/models/product.model.js';
import { currentMembership } from '../membership/membership.service.js';
import { verifyTransaction } from '../../services/paystack.js';
import logger from '../../config/logger.js';

/**
 * Real checkout (OrderModel previously had zero writers — FE totals were mock).
 * Prices, stock, discount and shipping are computed SERVER-side; the client
 * only chooses items + shipping method. Payment is a verified Paystack
 * reference (test mode). Member merchReduction comes from the membership tier.
 */

export const SHIPPING_FEES = Object.freeze({ standard: 1500, express: 3000 });
export const FREE_SHIPPING_THRESHOLD = 50000;

export const priceQuote = async ({ userId, items, shippingMethod = 'standard' }) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('Cart is empty'), { statusCode: 400 });
  }
  if (!Object.keys(SHIPPING_FEES).includes(shippingMethod)) {
    throw Object.assign(new Error('Unknown shipping method'), { statusCode: 400 });
  }

  const products = await ProductModel.find({
    _id: { $in: items.map((i) => i.productId) },
  }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  const lines = items.map((i) => {
    const qty = Math.floor(Number(i.quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      throw Object.assign(new Error('Invalid quantity'), { statusCode: 400 });
    }
    const p = byId.get(String(i.productId));
    if (!p) throw Object.assign(new Error('Product not found'), { statusCode: 404 });
    if ((p.inventory?.stock ?? 0) < qty) {
      throw Object.assign(new Error(`Insufficient stock for ${p.name}`), { statusCode: 400 });
    }
    const unit = p.discountedPrice ?? p.price;
    subtotal += unit * qty;
    return {
      product: p._id,
      quantity: qty,
      priceAtPurchase: unit,
      selectedVariant: i.selectedVariant,
    };
  });

  const membership = await currentMembership(userId);
  const pct = Number(membership.entitlements?.merchDiscountPct) || 0;
  const discount = Math.round((subtotal * pct) / 100);
  const shipping = subtotal - discount > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEES[shippingMethod];
  const total = subtotal - discount + shipping;

  return { lines, subtotal, discountPct: pct, discount, shipping, shippingMethod, total, tier: membership.tier };
};

export const placeOrder = async ({ user, items, shippingMethod = 'standard', shippingAddress, paymentReference }) => {
  if (!paymentReference) throw Object.assign(new Error('Payment reference required'), { statusCode: 400 });

  // Idempotency: same Paystack reference never creates two orders.
  const existing = await OrderModel.findOne({ 'paymentInfo.transactionId': paymentReference }).lean();
  if (existing) return { order: existing, idempotent: true };

  const quote = await priceQuote({ userId: user._id, items, shippingMethod });

  const payment = await verifyTransaction(paymentReference);
  if (payment?.status !== 'success' || Math.round((payment?.amount || 0) / 100) < quote.total) {
    throw Object.assign(new Error('Payment not successful or underpaid'), { statusCode: 402 });
  }

  // Atomic stock guard: all-or-nothing decrement.
  const stockOps = quote.lines.map((l) => ({
    updateOne: {
      filter: { _id: l.product, 'inventory.stock': { $gte: l.quantity } },
      update: { $inc: { 'inventory.stock': -l.quantity } },
    },
  }));
  const stockRes = await ProductModel.bulkWrite(stockOps);
  if (stockRes.modifiedCount !== quote.lines.length) {
    throw Object.assign(new Error('Stock changed during checkout — please retry'), { statusCode: 409 });
  }

  const order = await OrderModel.create({
    user: user._id,
    orderNumber: `DTV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    items: quote.lines,
    paymentInfo: {
      method: 'paystack',
      transactionId: paymentReference,
      status: 'completed',
      amount: quote.total,
      currency: 'NGN',
    },
    subtotal: quote.subtotal,
    shippingFee: quote.shipping,
    tax: 0,
    discount: quote.discount,
    total: quote.total,
    status: 'processing',
  });

  logger.info('Order placed', { order: order.orderNumber, user: String(user._id), total: quote.total, tier: quote.tier });
  return { order: order.toObject(), idempotent: false };
};

export const listOrders = async (userId, { page = 1, limit = 12 } = {}) => {
  const pg = Math.max(1, parseInt(page) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit) || 12));
  const [data, total] = await Promise.all([
    OrderModel.find({ user: userId }).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    OrderModel.countDocuments({ user: userId }),
  ]);
  return { data, total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) };
};

export const getOrder = async ({ orderId, sessionUser }) => {
  const order = await OrderModel.findById(orderId).lean();
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (String(order.user) !== String(sessionUser._id) && sessionUser.role !== 'admin') {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }
  return order;
};

export default { priceQuote, placeOrder, listOrders, getOrder, SHIPPING_FEES };
