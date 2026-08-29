import * as talentService from './talent.service.js';
import logger from '../../config/logger.js';

/**
 * @desc List public talent feed (ranked)
 */
export const listTalent = async (req, res, next) => {
  try {
    const { page, limit, sort, genre, status, search } = req.query;
    const result = await talentService.listUploads({ page, limit, sort, genre, status, search });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
};

export const getCurated = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await talentService.curatedQueue({ page, limit });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
};

export const getTalentById = async (req, res, next) => {
  try {
    const doc = await (await import('./talent.model.js')).then(m=> m.TalentUploadModel.findById(req.params.id).populate('uploader','username avatar name lastname').lean());
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (e) { next(e); }
};

export const uploadTalent = async (req, res, next) => {
  try {
    const { artistName, title, genre, description } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'Audio/video file required (field: file)' });
    if (!artistName || !title) return res.status(400).json({ success: false, message: 'artistName and title required' });

    const doc = await talentService.createUpload({
      artistName, title, genre, description,
      file: req.file,
      coverFile: req.files?.cover?.[0] ?? null,
      uploaderId: req.user._id,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (e) { logger.error('uploadTalent failed', { error: e.message }); next(e); }
};

export const likeTalent = async (req, res, next) => {
  try {
    const result = await talentService.toggleLike(req.params.id, req.user._id);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
};

export const shareTalent = async (req, res, next) => {
  try {
    const doc = await talentService.incrementShare(req.params.id);
    res.json({ success: true, shareCount: doc.shareCount });
  } catch (e) { next(e); }
};

export const playTalent = async (req, res, next) => {
  try {
    const doc = await talentService.incrementPlay(req.params.id, req.user?._id);
    res.json({ success: true, plays: doc.plays });
  } catch (e) { next(e); }
};

export const addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text required' });
    // For brevity, store comments as separate collection or embed later - simple inc
    const doc = await (await import('./talent.model.js')).then(m=> m.TalentUploadModel.findByIdAndUpdate(req.params.id, { $inc: { commentCount: 1 } }, { new: true }));
    res.json({ success: true, commentCount: doc.commentCount });
  } catch (e) { next(e); }
};

export const callUp = async (req, res, next) => {
  try {
    const doc = await talentService.triggerCallUp({ id: req.params.id, adminUser: req.user });
    res.json({ success: true, message: 'Call-Up triggered - artist notified', data: doc });
  } catch (e) { next(e); }
};

export const flag = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const doc = await talentService.flagUpload({ id: req.params.id, reason: reason || 'No reason', adminUser: req.user });
    res.json({ success: true, data: doc });
  } catch (e) { next(e); }
};

export default { listTalent, getCurated, getTalentById, uploadTalent, likeTalent, shareTalent, playTalent, addComment, callUp, flag };
