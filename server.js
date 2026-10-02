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
const app = express();

// ── Middleware ──────────────────────────────────
// OBS-01: correlation first — every downstream log/error carries req.id.
app.use(requestId);
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

// ── New modular routes (preferred) ──────────────
// Mount under /api for new FE, and bare for legacy compat
app.use('/api/talent-upload', TalentRouter);
app.use('/talent-upload', TalentRouter); // bare for old FE compat

app.use('/api/youtube', YoutubeRouter);
app.use('/api/user', UserRouter);
app.use('/api/identity', IdentityRouter);
app.use('/api/posts', PostRouter);
app.use('/api/post', PostRouter);
app.use('/api/notifications', NotificationRouter);

// ── Legacy routes (unchanged) ───────────────────
app.use('/auth', AuthRouter);
app.use('/email', EmailSubscriptionRouter);
app.use('/youtube', YoutubeRouterLegacy);
app.use('/user', UserRouterLegacy);
app.use('/forum', ForumRouter);
app.use('/event', EventRouter);
app.use('/contact', ContactRouter);
app.use('/playlist', PlaylistRouter);
app.use('/settings', SettingsRouter);
app.use('/image', ProfileImageRouter);
app.use('/store', StoreRouter);
app.use('/transaction', TransactionRouter);

// Static
app.use('/uploads', express.static(path.join(process.cwd(), 'src', 'uploads')));

// Rate limit for unknown routes
app.use(apiLimiter);

// 404 + error handler (must be last)
app.use(notFound);
app.use(errorHandler);

// ── Boot ────────────────────────────────────────
initFirebase();

connectDB()
  .then(() => {
    logger.info('Connected to MongoDB');
    // Start new cron pipeline (legacy crawlers already scheduled above)
    try { startCronJobs(); } catch (e) { logger.error('Cron init failed', { error: e.message }); }

    app.listen(port, () => {
      logger.info(`Server running on http://localhost:${port}`, { port, env: process.env.NODE_ENV || 'development' });
    });
  })
  .catch((error) => {
    logger.error('MongoDB connection failed', { error: error.message });
    process.exit(1);
  });

export default app;
