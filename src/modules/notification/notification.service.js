import mongoose from 'mongoose';
import logger from '../../config/logger.js';

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

export default { NotificationModel, create, listForUser, markRead, markAllRead };
