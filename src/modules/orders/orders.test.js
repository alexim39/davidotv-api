import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import request from 'supertest';
import { connectTestDB, clearTestDB, closeTestDB } from '../../test/db.js';
import { UserModel } from '../../apps/user/models/user.model.js';
import { ProductModel } from '../../apps/store/models/product.model.js';
import { MembershipModel } from '../membership/membership.model.js';
import { signAuthToken } from '../../config/auth.js';
import { priceQuote } from './orders.service.js';
import { createApp } from '../../../server.js';

// Real checkout: server-side pricing, member discount, stock guard,
// verified payment. Paystack verify is spied (real axios module intact so
// server.js imports — incl. axios.create in the crawler — keep working).

const OLD_SECRET = process.env.JWT_SECRET;
let app;
let fan;
let member;
let fanToken;
let memberToken;
let shirt;

const mkUser = (u, extra = {}) => UserModel.create({
  username: u, name: 'T', lastname: 'U', email: `${u}@testmail.com`,
  password: 'x'.repeat(12), ...extra,
});

beforeAll(async () => {
  process.env.JWT_SECRET = 'orders-test-secret';
  await connectTestDB();
  app = createApp();
});

afterAll(async () => {
  process.env.JWT_SECRET = OLD_SECRET;
  await closeTestDB();
});

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await clearTestDB();
  vi.spyOn(axios, 'get').mockReset();
  fan = await mkUser('orderfan');
  member = await mkUser('ordermember');
  fanToken = signAuthToken(fan._id);
  memberToken = signAuthToken(member._id);
  shirt = await ProductModel.create({
    name: '30BG Tee', description: 'Cotton tee', price: 10000,
    categories: ['apparel'], inventory: { stock: 5 },
  });
  // Active monthly membership → 10% merch off.
  const now = new Date();
  await MembershipModel.create({
    user: member._id, tier: 'fan_monthly', status: 'active', amountNgn: 900,
    currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86400000),
  });
});

const items = () => [{ productId: String(shirt._id), quantity: 1 }];

describe('priceQuote (member discount server-side)', () => {
  it('gives free-tier buyers no discount, members 10%', async () => {
    const free = await priceQuote({ userId: fan._id, items: items(), shippingMethod: 'standard' });
    expect(free).toMatchObject({ subtotal: 10000, discount: 0, shipping: 1500, total: 11500 });
    const paid = await priceQuote({ userId: member._id, items: items(), shippingMethod: 'standard' });
    expect(paid).toMatchObject({ subtotal: 10000, discount: 1000, discountPct: 10, total: 10500 });
  });

  it('400s empty carts and short stock', async () => {
    await expect(priceQuote({ userId: fan._id, items: [] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(priceQuote({ userId: fan._id, items: [{ productId: String(shirt._id), quantity: 99 }] }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('POST /checkout', () => {
  it('creates a discounted order on verified payment and decrements stock', async () => {
    axios.get.mockResolvedValue({ data: { data: { status: 'success', amount: 10500 * 100, reference: 'ref-1' } } });

    const res = await request(app).post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ items: items(), shippingMethod: 'standard', paymentReference: 'ref-1' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ total: 10500, discount: 1000, status: 'processing' });
    expect(res.body.data.paymentInfo.transactionId).toBe('ref-1');
    const fresh = await ProductModel.findById(shirt._id).lean();
    expect(fresh.inventory.stock).toBe(4);
  });

  it('is idempotent on payment-reference replay', async () => {
    axios.get.mockResolvedValue({ data: { data: { status: 'success', amount: 10500 * 100, reference: 'ref-2' } } });
    const body = { items: items(), shippingMethod: 'standard', paymentReference: 'ref-2' };
    const auth = (r) => r.set('Authorization', `Bearer ${memberToken}`);
    const first = await auth(request(app).post('/api/v1/orders/checkout')).send(body);
    const second = await auth(request(app).post('/api/v1/orders/checkout')).send(body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.idempotent).toBe(true);
    expect(second.body.data._id).toBe(first.body.data._id);
  });

  it('402s underpaid references and 401s anonymously', async () => {
    axios.get.mockResolvedValue({ data: { data: { status: 'success', amount: 100, reference: 'ref-3' } } });
    const under = await request(app).post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ items: items(), paymentReference: 'ref-3' });
    expect(under.status).toBe(402);
    const anon = await request(app).post('/api/v1/orders/checkout').send({ items: items() });
    expect(anon.status).toBe(401);
  });
});

describe('order reads', () => {
  it('lists own orders and 403s foreign ones', async () => {
    axios.get.mockResolvedValue({ data: { data: { status: 'success', amount: 11500 * 100, reference: 'ref-4' } } });
    const placed = await request(app).post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${fanToken}`)
      .send({ items: items(), paymentReference: 'ref-4' });
    expect(placed.status).toBe(201);

    const list = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${fanToken}`);
    expect(list.body.total).toBe(1);

    const otherToken = signAuthToken((await mkUser('stranger'))._id);
    const foreign = await request(app).get(`/api/v1/orders/${placed.body.data._id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(foreign.status).toBe(403);
  });
});
