import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

/**
 * P2 DB harness: ephemeral MongoDB for contract tests. No Atlas, no network
 * beyond the one-time mongod binary download (cached in ~/.cache).
 * Auth-dependent tests set process.env.JWT_SECRET (read lazily by
 * config/auth.js) — never the real secret.
 */

let mongod = null;

export const connectTestDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  // Cold mongod start on a loaded box exceeds the 10s default — v11 key is
  // `launchTimeout` (a `startTimeout` key is silently ignored).
  mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 120000 } });
  await mongoose.connect(mongod.getUri());
};

export const clearTestDB = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

export const closeTestDB = async () => {
  await mongoose.disconnect().catch(() => {});
  if (mongod) await mongod.stop();
  mongod = null;
};

export default { connectTestDB, clearTestDB, closeTestDB };
