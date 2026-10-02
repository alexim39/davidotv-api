import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';

// ── New modular config ──────────────────────────
import logger from './src/config/logger.js';
import connectDB from './src/config/database.js';
import { initFirebase } from './src/config/firebase.js';
import { errorHandler, notFound } from './src/middleware/errorHandler.js';
import { apiLimiter } from './src/middleware/rateLimiter.js';
import { requestId } from './src/middleware/requestId.js';
import { deprecated } from './src/middleware/deprecation.js';
import { fileURLToPath } from 'url';

// Single pipeline lives in modules/youtube (SEC-04). Legacy crawlers are
// flag-gated below (after dotenv) and OFF by default — they duplicate quota.
import { startCronJobs } from './src/modules/youtube/crawler.service.js';

// Legacy routers (kept for backward compat)
import AuthRouter from './src/apps/auth/index.js';
import YoutubeRouterLegacy from './src/apps/youtube/index.js';
import EmailSubscriptionRouter from './src/apps/email-subscription/index.js';
import UserRouterLegacy from './src/apps/user/index.js';
import ForumRouter from './src/apps/forum/index.js';
import EventRouter from './src/apps/event/index.js';
import ContactRouter from './src/apps/contact/index.js';
import PlaylistRouter from './src/apps/playlist/index.js';
import SettingsRouter from './src/apps/settings/index.js';
import ProfileImageRouter from './src/services/profile-image.js';
import StoreRouter from './src/apps/store/index.js';
import TransactionRouter from './src/apps/transaction/index.js';

// New modular routers (Controller-Service-Repository)
import TalentRouter from './src/modules/talent-upload/talent.routes.js';
import YoutubeRouter from './src/modules/youtube/youtube.routes.js';
import UserRouter from './src/modules/user/user.routes.js';
import PostRouter from './src/modules/post/post.routes.js';
import NotificationRouter from './src/modules/notification/notification.routes.js';
import IdentityRouter from './src/modules/identity/identity.routes.js';
import AnalyticsRouter from './src/modules/analytics/analytics.routes.js';
import MembershipRouter from './src/modules/membership/membership.routes.js';

dotenv.config();

// SEC-04: legacy YouTube crawlers OFF by default. Dynamic import (not static)
// so the flag is read AFTER dotenv loads — static imports would hoist above it
// and miss .env. Set FEATURE_LEGACY_CRAWLERS=true only for rollback.
if (process.env.FEATURE_LEGACY_CRAWLERS === 'true') {
  logger.warn('Legacy YouTube crawlers ENABLED via flag — duplicates quota with new pipeline');
  await import('./src/apps/youtube/services/crawler.js');
  await import('./src/apps/youtube/services/crawler2.js');
  await import('./src/apps/youtube/services/crawler3.js');
} else {
  logger.info('Legacy YouTube crawlers disabled (SEC-04) — single pipeline active');
}

const port = process.env.PORT || 3000;

// ── App factory (API-01): importable without side effects (no DB, no listen)
// so supertest can mount it. Direct execution still boots below.
export const createApp = () => {
  const app = express();

  // ── Middleware ──────────────────────────────────
  // OBS-01: correlation first — every downstream log/error carries req.id.
  app.use(requestId);
  // API-01: rate-limit real traffic (was post-mount, i.e. 404s only).
  app.use(apiLimiter);
  // Membership webhook needs the RAW body for HMAC — before express.json.
  app.use('/api/v1/membership/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
  app.use('/api/membership/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(cors({
    credentials: true,
    origin: [
      'http://localhost:4200',
      'https://davidotv.com',
      'http://davidotv.com',
      'https://www.davidotv.com',
      'http://localhost:3000',
    ],
  }));

  // Health
  app.get('/', (req, res) => res.json({ success: true, message: 'DavidO TV API — modular v2 (midnight luxury)', version: '2.0.0' }));
  app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // API-01: version discovery document.
  app.get('/api/v1', (_req, res) => res.json({
    success: true,
    name: 'DavidO TV API',
    version: 'v1',
    mounts: ['talent-upload', 'youtube', 'user', 'posts', 'notifications', 'identity', 'analytics', 'membership'],
  }));

  // ── Modular routes: canonical /api/v1 + compat /api and bare ──
  app.use('/api/v1/talent-upload', TalentRouter);
  app.use('/api/talent-upload', TalentRouter);
  app.use('/talent-upload', TalentRouter); // bare for old FE compat

  app.use('/api/v1/youtube', YoutubeRouter);
  app.use('/api/youtube', YoutubeRouter);

  app.use('/api/v1/user', UserRouter);
  app.use('/api/user', UserRouter);

  app.use('/api/v1/identity', IdentityRouter);
  app.use('/api/identity', IdentityRouter);

  app.use('/api/v1/posts', PostRouter);
  app.use('/api/v1/post', PostRouter);
  app.use('/api/posts', PostRouter);
  app.use('/api/post', PostRouter);

  app.use('/api/v1/notifications', NotificationRouter);
  app.use('/api/notifications', NotificationRouter);

  app.use('/api/v1/analytics', AnalyticsRouter);
  app.use('/api/analytics', AnalyticsRouter);

  app.use('/api/v1/membership', MembershipRouter);
  app.use('/api/membership', MembershipRouter);

  // ── Legacy routes (frozen, deprecated — do not add endpoints here) ──
  app.use('/auth', deprecated, AuthRouter);
  app.use('/email', deprecated, EmailSubscriptionRouter);
  app.use('/youtube', deprecated, YoutubeRouterLegacy);
  app.use('/user', deprecated, UserRouterLegacy);
  app.use('/forum', deprecated, ForumRouter);
  app.use('/event', deprecated, EventRouter);
  app.use('/contact', deprecated, ContactRouter);
  app.use('/playlist', deprecated, PlaylistRouter);
  app.use('/settings', deprecated, SettingsRouter);
  app.use('/image', deprecated, ProfileImageRouter);
  app.use('/store', deprecated, StoreRouter);
  app.use('/transaction', deprecated, TransactionRouter);

  // Static
  app.use('/uploads', express.static(path.join(process.cwd(), 'src', 'uploads')));

  // 404 + error handler (must be last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
};

// ── Boot (direct execution only: node server.js) ──
const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  initFirebase();

  connectDB()
    .then(() => {
      logger.info('Connected to MongoDB');
      // Start new cron pipeline (legacy crawlers already scheduled above)
      try { startCronJobs(); } catch (e) { logger.error('Cron init failed', { error: e.message }); }

      createApp().listen(port, () => {
        logger.info(`Server running on http://localhost:${port}`, { port, env: process.env.NODE_ENV || 'development' });
      });
    })
    .catch((error) => {
      logger.error('MongoDB connection failed', { error: error.message });
      process.exit(1);
    });
}

export default createApp;
