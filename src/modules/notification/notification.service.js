import mongoose from 'mongoose';
import logger from '../../config/logger.js';
import { NotificationPreferenceModel } from './preferences.model.js';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['CALL_UP','LIKE','COMMENT','FOLLOW','SYSTEM'], required: true },
  title: { type: String, required: true },
  body: { type: String },
  data: { type: mongoose.Schema.Types.Mixed },
  read: { type: Boolean, default: false, index: true },
}, { timestamps: true });

notificationSchema.index({ recipient:1, createdAt:-1 });

export const NotificationModel = mongoose.model('Notification', notificationSchema);

export const create = async ({ recipient, actor, type, title, body, data }) => {
  const n = await NotificationModel.create({ recipient, actor, type, title, body, data });
  logger.info('Notification created', { type, recipient });
  return n;
};

export const listForUser = async (userId, { page=1, limit=20, unreadOnly=false }={}) => {
  const q = { recipient: userId };
  if (unreadOnly) q.read = false;
  const pg = Math.max(1,parseInt(page)), lim=Math.min(50,parseInt(limit));
  const [data,total] = await Promise.all([
    NotificationModel.find(q).sort({ createdAt: -1 }).skip((pg-1)*lim).limit(lim).lean(),
    NotificationModel.countDocuments(q)
  ]);
  return { data, total, page:pg, limit:lim };
};

export const markRead = async (userId, id) => {
  return NotificationModel.findOneAndUpdate({ _id:id, recipient:userId }, { read:true }, { new:true });
};

export const markAllRead = async (userId) => {
  return NotificationModel.updateMany({ recipient:userId, read:false }, { read:true });
};

const KNOWN_TYPES = ['CALL_UP', 'LIKE', 'COMMENT', 'FOLLOW', 'SYSTEM'];

/** Defaults upserted — every user effectively has preferences. */
export const getPreferences = async (userId) => {
  const doc = await NotificationPreferenceModel.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { new: true, upsert: true }
  ).lean();
  return doc;
};

/** Whitelisted fields only; unknown muted types dropped. */
export const updatePreferences = async (userId, patch = {}) => {
  const update = {};
  if (typeof patch.push === 'boolean') update.push = patch.push;
  if (typeof patch.email === 'boolean') update.email = patch.email;
  if (Array.isArray(patch.mutedTypes)) {
    update.mutedTypes = [...new Set(patch.mutedTypes.filter((t) => KNOWN_TYPES.includes(t)))];
  }
  const doc = await NotificationPreferenceModel.findOneAndUpdate(
    { user: userId },
    { $set: update, $setOnInsert: { user: userId } },
    { new: true, upsert: true }
  ).lean();
  return doc;
};

/**
 * Channel gate for fan-out senders. In-app always passes (core bell).
 * Returns true when the (type, channel) pair should SEND.
 */
export const shouldSend = async (userId, type, channel) => {
  if (channel === 'inApp') return true;
  if (channel !== 'push' && channel !== 'email') return false;
  const prefs = await getPreferences(userId);
  if (prefs[channel] === false) return false;
  if ((prefs.mutedTypes || []).includes(type)) return false;
  return true;
};

export default { NotificationModel, create, listForUser, markRead, markAllRead, getPreferences, updatePreferences, shouldSend };
