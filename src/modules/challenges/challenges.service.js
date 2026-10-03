import { ChallengeModel } from './challenge.model.js';
import { TalentUploadModel } from '../talent-upload/talent.model.js';
import logger from '../../config/logger.js';

/** Admin creates a draft or scheduled challenge. */
export const createChallenge = async ({ title, description, hashtag, startsAt, endsAt }) => {
  if (!title?.trim()) throw Object.assign(new Error('Title is required'), { statusCode: 400 });
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (isNaN(start) || isNaN(end) || end <= start) {
    throw Object.assign(new Error('Valid startsAt/endsAt window is required'), { statusCode: 400 });
  }
  const doc = await ChallengeModel.create({ title: title.trim(), description, hashtag, startsAt: start, endsAt: end });
  logger.info('Challenge created', { id: String(doc._id), title: doc.title });
  return doc;
};

export const listChallenges = async ({ status, page = 1, limit = 12 } = {}) => {
  const q = { isDeleted: false };
  if (status) q.status = status;
  const pg = Math.max(1, parseInt(page) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(limit) || 12));
  const [data, total] = await Promise.all([
    ChallengeModel.find(q).sort({ endsAt: 1 }).skip((pg - 1) * lim).limit(lim).lean(),
    ChallengeModel.countDocuments(q),
  ]);
  return { data, total, page: pg, limit: lim, totalPages: Math.ceil(total / lim) };
};

export const setStatus = async ({ id, status }) => {
  if (!['draft', 'active', 'judging', 'closed'].includes(status)) {
    throw Object.assign(new Error('Unknown status'), { statusCode: 400 });
  }
  const doc = await ChallengeModel.findOneAndUpdate(
    { _id: id, isDeleted: false }, { status }, { new: true }
  );
  if (!doc) throw Object.assign(new Error('Challenge not found'), { statusCode: 404 });
  return doc;
};

/** Enter one of your own uploads while the challenge is active. */
export const enterChallenge = async ({ id, uploadId, sessionUser }) => {
  const challenge = await ChallengeModel.findOne({ _id: id, isDeleted: false });
  if (!challenge) throw Object.assign(new Error('Challenge not found'), { statusCode: 404 });
  if (challenge.status !== 'active') {
    throw Object.assign(new Error('Challenge is not accepting entries'), { statusCode: 400 });
  }
  const upload = await TalentUploadModel.findById(uploadId).select('uploader').lean();
  if (!upload) throw Object.assign(new Error('Upload not found'), { statusCode: 404 });
  if (String(upload.uploader) !== String(sessionUser._id) && sessionUser.role !== 'admin') {
    throw Object.assign(new Error('You can only enter your own uploads'), { statusCode: 403 });
  }
  if (challenge.entries.some((e) => String(e.upload) === String(uploadId))) {
    throw Object.assign(new Error('Upload already entered'), { statusCode: 409 });
  }
  challenge.entries.push({ upload: uploadId, entrant: sessionUser._id });
  await challenge.save();
  return challenge.toObject();
};

/** Admin declares the winner (must be an entered upload). */
export const decideWinner = async ({ id, uploadId, adminUser }) => {
  const challenge = await ChallengeModel.findOne({ _id: id, isDeleted: false });
  if (!challenge) throw Object.assign(new Error('Challenge not found'), { statusCode: 404 });
  if (!challenge.entries.some((e) => String(e.upload) === String(uploadId))) {
    throw Object.assign(new Error('Winner must be an entered upload'), { statusCode: 400 });
  }
  challenge.winnerUpload = uploadId;
  challenge.decidedAt = new Date();
  challenge.decidedBy = adminUser._id;
  challenge.status = 'closed';
  await challenge.save();
  logger.info('Challenge decided', { id: String(challenge._id), winner: String(uploadId) });
  return challenge.toObject();
};

export default { createChallenge, listChallenges, setStatus, enterChallenge, decideWinner };
