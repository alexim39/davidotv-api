import mongoose from 'mongoose';
import logger from './logger.js';

/**
 * Centralized MongoDB connector.
 * Keeps server.js slim; exposes connect + graceful shutdown.
 */
export const connectDB = async () => {
  const { MONGODB_USERNAME, MONGODB_PASSWORD, MONGODB_DATABASE } = process.env;
  if (!MONGODB_USERNAME || !MONGODB_PASSWORD || !MONGODB_DATABASE) {
    logger.error('Missing MongoDB env vars');
    throw new Error('MongoDB env not configured');
  }
  const uri = `mongodb+srv://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@cluster0.ltu282p.mongodb.net/${MONGODB_DATABASE}?retryWrites=true&w=majority`;

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info('✅ MongoDB connected', { host: mongoose.connection.host, db: MONGODB_DATABASE });
};

export default connectDB;
