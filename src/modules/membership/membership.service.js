import axios from 'axios';
import crypto from 'crypto';
import { MembershipModel } from './membership.model.js';
import { PLANS, PAID_TIERS, entitlementsFor } from './plans.js';
import logger from '../../config/logger.js';

/**
 * Pay-as-you-go membership billing (Paystack test mode until explicit
 * live cutover — see docs. Uses PAYSTACK_SECRET, legacy PAYSTACKTOKEN fallback.
 * No cards stored, no subscriptions API: each purchase = one entitlement window.
 */

const paystackSecret = () => process.env.PAYSTACK_SECRET || process.env.PAYSTACKTOKEN;
const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');

export const listPlans = () => Object.values(PLANS).map((p) => ({
  id: p.id,
  name: p.name,
  priceNgn: p.priceNgn,
  days: p.days,
  tagline: p.tagline,
  entitlements: p.entitlements,
}));

/** Current effective membership: newest active, unexpired row — else free. */
export const currentMembership = async (userId) => {
  const now = new Date();
  const active = await MembershipModel.findOne({
    user: userId,
    status: 'active',
    currentPeriodEnd: { $gt: now },
  })
    .sort({ currentPeriodEnd: -1 })
    .lean();
  if (!active) return { tier: 'free', status: 'inactive', entitlements: entitlementsFor('free') };
  return {
    tier: active.tier,
    status: active.status,
    currentPeriodStart: active.currentPeriodStart,
    currentPeriodEnd: active.currentPeriodEnd,
    entitlements: entitlementsFor(active.tier),
  };
};

export const startSubscription = async ({ user, tier }) => {
  if (!PAID_TIERS.includes(tier)) {
    throw Object.assign(new Error('Unknown or free tier — nothing to bill'), { statusCode: 400 });
  }
  const secret = paystackSecret();
  if (!secret) throw Object.assign(new Error('Billing not configured'), { statusCode: 503 });

  const plan = PLANS[tier];
  const reference = crypto.randomUUID();
  const membership = await MembershipModel.create({
    user: user._id,
    tier,
    status: 'pending',
    paystackReference: reference,
    amountNgn: plan.priceNgn,
  });

  const { data } = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    {
      email: user.email,
      amount: plan.priceNgn * 100, // kobo
      reference,
      callback_url: `${frontendUrl()}/membership/verify?reference=${reference}`,
      metadata: { userId: String(user._id), tier, membershipId: String(membership._id) },
    },
    { headers: { Authorization: `Bearer ${secret}` }, timeout: 15000 }
  );

  if (!data?.status) throw Object.assign(new Error('Paystack initialization failed'), { statusCode: 502 });
  logger.info('Subscription initialized', { user: String(user._id), tier, reference });
  return { authorizationUrl: data.data.authorization_url, reference, tier };
};

/** Activate on verified payment. Idempotent by reference. */
export const activateFromReference = async (reference, paystackPayload) => {
  const membership = await MembershipModel.findOne({ paystackReference: reference });
  if (!membership) throw Object.assign(new Error('Unknown payment reference'), { statusCode: 404 });
  if (membership.status === 'active') return membership; // idempotent replay

  const plan = PLANS[membership.tier];
  const paidNgn = Math.round((paystackPayload?.amount || 0) / 100);
  if (paystackPayload?.status !== 'success' || paidNgn < membership.amountNgn) {
    membership.status = 'expired'; // failed/partial payment never activates
    await membership.save();
    throw Object.assign(new Error('Payment not successful'), { statusCode: 402 });
  }

  const now = new Date();
  membership.status = 'active';
  membership.currentPeriodStart = now;
  membership.currentPeriodEnd = new Date(now.getTime() + plan.days * 86400000);
  await membership.save();
  logger.info('Membership activated', { user: String(membership.user), tier: membership.tier, reference });
  return membership;
};

export const verifySubscription = async (reference) => {
  const secret = paystackSecret();
  if (!secret) throw Object.assign(new Error('Billing not configured'), { statusCode: 503 });
  const { data } = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secret}` },
    timeout: 15000,
  });
  return activateFromReference(reference, data?.data);
};

export const verifyWebhookSignature = (rawBody, signature) => {
  const secret = paystackSecret() || '';
  const digest = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  return signature === digest;
};

export const cancelSubscription = async (userId) => {
  // Keeps benefits until period end (grace by design, §10.7).
  const current = await MembershipModel.findOne({ user: userId, status: 'active' }).sort({
    currentPeriodEnd: -1,
  });
  if (!current) throw Object.assign(new Error('No active membership'), { statusCode: 404 });
  current.status = 'cancelled';
  current.cancelledAt = new Date();
  await current.save();
  return current;
};

export default {
  PLANS,
  listPlans,
  currentMembership,
  startSubscription,
  activateFromReference,
  verifySubscription,
  verifyWebhookSignature,
  cancelSubscription,
};
