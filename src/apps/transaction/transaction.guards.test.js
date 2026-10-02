import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { connectTestDB, clearTestDB, closeTestDB } from '../../test/db.js';
import { UserModel } from '../user/models/user.model.js';
import { signAuthToken } from '../../config/auth.js';
import { createApp } from '../../../server.js';

// SEC-03 guard tests: owner checks + validation resolve BEFORE any Paystack
// or email side effect, so no network is touched here.

const OLD_SECRET = process.env.JWT_SECRET;
let app;
let alice;
let bob;
let aliceToken;

beforeAll(async () => {
  process.env.JWT_SECRET = 'guard-test-secret';
  await connectTestDB();
  app = createApp();
});

afterAll(async () => {
  process.env.JWT_SECRET = OLD_SECRET;
  await closeTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  alice = await UserModel.create({
    username: 'alice', name: 'Alice', lastname: 'A', email: 'alice@testmail.com',
    password: 'x'.repeat(12), balance: 5000,
  });
  bob = await UserModel.create({
    username: 'bob', name: 'Bob', lastname: 'B', email: 'bob@testmail.com',
    password: 'x'.repeat(12),
  });
  aliceToken = signAuthToken(alice._id);
});

const auth = (req, token = aliceToken) => req.set('Authorization', `Bearer ${token}`);

describe('transaction owner guards', () => {
  it('403s withdraw for a foreign body userId (IDOR closed)', async () => {
    const res = await auth(request(app).post('/transaction/withdraw-request')).send({
      userId: String(bob._id),
      bank: '044', bankName: 'Access', accountNumber: '0123456789',
      accountName: 'Bob B', amount: 1000,
    });
    expect(res.status).toBe(403);
  });

  it('400s below-minimum amounts before any debit', async () => {
    const res = await auth(request(app).post('/transaction/withdraw-request')).send({
      userId: String(alice._id),
      bank: '044', bankName: 'Access', accountNumber: '0123456789',
      accountName: 'Alice A', amount: 50,
    });
    expect(res.status).toBe(400);
  });

  it('403s foreign history, 200s own history', async () => {
    const foreign = await auth(request(app).get(`/transaction/${bob._id}`));
    expect(foreign.status).toBe(403);
    const own = await auth(request(app).get(`/transaction/${alice._id}`));
    expect(own.status).toBe(200);
    expect(own.body.data).toEqual([]);
  });

  it('401s without a session', async () => {
    const res = await request(app).get(`/transaction/${alice._id}`);
    expect(res.status).toBe(401);
  });
});
