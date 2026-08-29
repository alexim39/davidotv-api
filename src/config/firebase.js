import logger from './logger.js';

let admin = null;
let initialized = false;
try {
  const mod = await import('firebase-admin');
  admin = mod.default;
} catch {
  logger.warn('firebase-admin not installed - push notifications disabled');
  admin = null;
}

/**
 * Lazy Firebase Admin init for Call-Up push notifications.
 * Requires GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT JSON env.
 */
export const initFirebase = () => {
  if (!admin) return null;
  if (initialized) return admin;
  try {
    if (admin.apps.length) { initialized = true; return admin; }

    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (saJson) {
      const serviceAccount = JSON.parse(saJson);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
    } else {
      logger.warn('Firebase not configured - push notifications disabled');
      return null;
    }
    initialized = true;
    logger.info('✅ Firebase Admin initialized');
    return admin;
  } catch (e) {
    logger.error('Firebase init failed', { error: e.message });
    return null;
  }
};

export const getFirebase = () => {
  if (!admin) return null;
  if (!initialized) return initFirebase();
  return admin.apps.length ? admin : null;
};

export default { initFirebase, getFirebase };
