import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'crypto';
import axios from 'axios';
import { connectTestDB, clearTestDB, closeTestDB } from '../../test/db.js';
import { UserModel } from '../../apps/user/models/user.model.js';
import { MembershipModel } from './membership.model.js';
import {
  listPlans,
  currentMembership,
  startSubscription,
  activateFromReference,
  verifyWebhookSignature,
  cancelSubscription,
} from './membership.service.js';

// Pay-as-you-go billing, Paystack mocked (no network, no real keys).

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

const OLD_SECRET = process.env.PAYSTACK_SECRET;
let fan;

beforeAll(async () => {
  process.env.PAYSTACK_SECRET = 'test-paystack-secret';
  await connectTestDB();
});

afterAll(async () => {
  process.env.PAYSTACK_SECRET = OLD_SECRET;
  await closeTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  vi.clearAllMocks();
  fan = await UserModel.create({
    username: 'payfan', name: 'Pay', lastname: 'Fan', email: 'payfan@testmail.com',
    password: 'x'.repeat(12),
  });
});

describe('plans (cheap by design)', () => {
  it('lists student-friendly tiers with pay-as-you-go windows', () => {
    const plans = listPlans();
    const weekly = plans.find((p) => p.id === 'fan_weekly');
    expect(weekly.priceNgn).toBe(300);
    expect(weekly.days).toBe(7);
    const monthly = plans.find((p) => p.id === 'fan_monthly');
    expect(monthly.priceNgn).toBeLessThanOrEqual(900);
    expect(plans.find((p) => p.id === 'free').priceNgn).toBe(0);
  });
});

describe('startSubscription', () => {
  it('400s free/unknown tiers before any Paystack call', async () => {
    await expect(startSubscription({ user: fan, tier: 'free' }))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(startSubscription({ user: fan, tier: 'platinum' }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('initializes in kobo with a UUID reference and pending row', async () => {
    axios.post.mockResolvedValue({ data: { status: true, data: { authorization_url: 'https://pay/x' } } });
    const res = await startSubscription({ user: fan, tier: 'fan_monthly' });
    expect(res.authorizationUrl).toBe('https://pay/x');
    const [url, body] = axios.post.mock.calls[0];
    expect(url).toContain('transaction/initialize');
    expect(body.amount).toBe(900 * 100);
    expect(body.email).toBe('payfan@testmail.com');
    const row = await MembershipModel.findOne({ paystackReference: res.reference });
    expect(row.status).toBe('pending');
    expect(row.amountNgn).toBe(900);
  });
});

describe('activation + idempotency', () => {
  it('activates a 30-day window on success, replays safely', async () => {
    axios.post.mockResolvedValue({ data: { status: true, data: { authorization_url: 'https://pay/x' } } });
    const { reference } = await startSubscription({ user: fan, tier: 'fan_monthly' });

    const first = await activateFromReference(reference, { status: 'success', amount: 90000 });
    expect(first.status).toBe('active');
    const days = (first.currentPeriodEnd - first.currentPeriodStart) / 86400000;
    expect(Math.round(days)).toBe(30);

    const replay = await activateFromReference(reference, { status: 'success', amount: 90000 });
    expect(replay.status).toBe('active');
    expect(await MembershipModel.countDocuments({ paystackReference: reference })).toBe(1);
  });

  it('never activates failed or underpaid webhooks', async () => {
    axios.post.mockResolvedValue({ data: { status: true, data: { authorization_url: 'https://pay/x' } } });
    const { reference } = await startSubscription({ user: fan, tier: 'fan_monthly' });
    await expect(activateFromReference(reference, { status: 'failed', amount: 90000 }))
      .rejects.toMatchObject({ statusCode: 402 });
    await expect(activateFromReference(reference, { status: 'success', amount: 100 }))
      .rejects.toMatchObject({ statusCode: 402 });
  });
});

describe('webhook signature', () => {
  it('accepts genuine HMAC-SHA512 and rejects forgeries', () => {
    const raw = Buffer.from('{"event":"charge.success"}');
    const good = crypto.createHmac('sha512', 'test-paystack-secret').update(raw).digest('hex');
    expect(verifyWebhookSignature(raw, good)).toBe(true);
    expect(verifyWebhookSignature(raw, 'deadbeef')).toBe(false);
  });
});

describe('current + cancel', () => {
  it('defaults to free and honours cancel-with-grace', async () => {
    const before = await currentMembership(fan._id);
    expect(before.tier).toBe('free');

    const active = await MembershipModel.create({
      user: fan._id, tier: 'fan_weekly', status: 'active', amountNgn: 300,
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 7 * 86400000),
    });
    const during = await currentMembership(fan._id);
    expect(during.tier).toBe('fan_weekly');
    expect(during.entitlements.earlyAccess).toBe(true);

    const cancelled = await cancelSubscription(fan._id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledAt).toBeDefined();
    expect(active._id.toString()).toBe(cancelled._id.toString());
  });

  it('404s cancel with no active membership', async () => {
    await expect(cancelSubscription(fan._id)).rejects.toMatchObject({ statusCode: 404 });
  });
});
