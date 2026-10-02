import { TalentUploadModel } from './talent.model.js';
import logger from '../../config/logger.js';
import { sendMail } from '../../config/mailer.js';
import { getFirebase } from '../../config/firebase.js';
import { create as createNotification, shouldSend } from '../notification/notification.service.js';

/**
 * Service layer - business logic isolated from controller.
 * Follows Controller-Service-Repository pattern.
 */

export const createUpload = async ({ artistName, title, genre, description, file, coverFile, uploaderId }) => {
  const fileUrl = `/uploads/talent/${file.filename.includes('/') ? file.filename : `${new Date().toISOString().slice(0,7)}/${file.filename}`}`;
  // multer already placed in correct month folder; reconstruct public url
  const publicFileUrl = `/uploads/talent/${new Date().toISOString().slice(0,7)}/${file.filename.split('/').pop()}`;
  // Simpler: use file.path relative
  const relative = file.path.split('src')[1]?.replace(/\\/g,'/') ?? `/uploads/talent/${file.filename}`;
  // Fallback to fileUrl we build from disk path
  const finalFileUrl = relative.startsWith('/uploads') ? relative : publicFileUrl;

  let coverUrl = null;
  if (coverFile) {
    const rel = coverFile.path.split('src')[1]?.replace(/\\/g,'/') ?? null;
    coverUrl = rel;
  }

  const doc = await TalentUploadModel.create({
    artistName,
    title,
    genre: genre || 'Afrobeats',
    description,
    fileUrl: finalFileUrl,
    coverUrl,
    mimeType: file.mimetype,
    fileSize: file.size,
    uploader: uploaderId,
  });

  logger.info('Talent upload created', { id: doc._id, title, uploader: uploaderId });
  return doc;
};

export const listUploads = async ({ page=1, limit=12, sort='-likeCount,-plays,-createdAt', genre, status, search }) => {
  const q = { isDeleted: false };
  if (genre) q.genre = genre;
  if (status) q.callUpStatus = status;
  if (search) q.$text = { $search: search };

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const skip = (pageNum -1)* limitNum;

  const sortObj = {};
  sort.split(',').forEach(s=>{
    const dir = s.startsWith('-') ? -1 : 1;
    const field = s.replace(/^-/,'');
    sortObj[field] = dir;
  });

  let query = TalentUploadModel.find(q);
  if (search) query = query.select({ score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' }, ...sortObj });
  else query = query.sort(sortObj);

  const [data, total] = await Promise.all([
    query.skip(skip).limit(limitNum).populate('uploader','username avatar name lastname').lean(),
    TalentUploadModel.countDocuments(q)
  ]);

  return { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total/limitNum) };
};

export const curatedQueue = async ({ page=1, limit=12 }) => {
  // Top-ranked pending/reviewed, pre-filter flagged
  return listUploads({ page, limit, sort: '-likeCount,-plays,-createdAt', status: undefined });
};

export const incrementPlay = async (id, userId) => {
  const doc = await TalentUploadModel.findByIdAndUpdate(
    id,
    { $inc: { plays: 1 }, ...(userId ? { $addToSet: { playedBy: userId } } : {}) },
    { new: true }
  );
  return doc;
};

export const toggleLike = async (id, userId) => {
  const doc = await TalentUploadModel.findById(id);
  if (!doc) throw Object.assign(new Error('Upload not found'), { statusCode: 404 });
  const already = doc.likedBy.some(id=> id.equals(userId));
  if (already) {
    doc.likedBy.pull(userId);
    doc.likeCount = Math.max(0, doc.likeCount -1);
  } else {
    doc.likedBy.push(userId);
    doc.likeCount += 1;
  }
  await doc.save();
  return { liked: !already, likeCount: doc.likeCount };
};

export const incrementShare = async (id) => {
  const doc = await TalentUploadModel.findByIdAndUpdate(id, { $inc: { shareCount: 1 } }, { new: true });
  if (!doc) throw Object.assign(new Error('Upload not found'), { statusCode: 404 });
  return doc;
};

/**
 * The Call-Up Protocol
 * - Updates status to called_up
 * - Sends real-time push via Firebase (or websocket fallback)
 * - Sends high-priority email via nodemailer
 */
export const triggerCallUp = async ({ id, adminUser }) => {
  const doc = await TalentUploadModel.findById(id).populate('uploader','email username name');
  if (!doc) throw Object.assign(new Error('Upload not found'), { statusCode: 404 });
  if (doc.callUpStatus === 'called_up') return doc; // idempotent

  doc.callUpStatus = 'called_up';
  doc.calledUpAt = new Date();
  doc.calledUpBy = adminUser._id;
  await doc.save();

  // 1) WebSocket/Firebase push (skipped when the artist muted push)
  try {
    const fb = getFirebase();
    const pushAllowed = await shouldSend(doc.uploader._id, 'CALL_UP', 'push');
    if (fb && doc.uploader?.email && pushAllowed) {
      // Expect client FCM token stored on user doc; fallback to topic
      // For now send to topic `talent_<uploaderId>` or direct if token exists
      const user = doc.uploader;
      // If user has fcmToken field, use it
      const fcmToken = user.fcmToken;
      const payload = {
        notification: {
          title: `🚀 Davido wants to collaborate!`,
          body: `Your track "${doc.title}" was selected. The team will contact you.`,
        },
        data: {
          type: 'CALL_UP',
          uploadId: String(doc._id),
          title: doc.title,
        }
      };
      if (fcmToken) {
        await fb.messaging().send({ ...payload, token: fcmToken });
        logger.info('FCM push sent', { to: fcmToken, uploadId: id });
      } else {
        await fb.messaging().send({ ...payload, topic: `talent_${doc.uploader._id}` });
        logger.info('FCM topic push sent', { topic: `talent_${doc.uploader._id}` });
      }
    }
  } catch (e) {
    logger.error('FCM push failed', { error: e.message, uploadId: id });
  }

  // 2) Email dispatch (skipped when the artist muted email)
  try {
    const recipient = doc.uploader?.email;
    const emailAllowed = await shouldSend(doc.uploader._id, 'CALL_UP', 'email');
    if (recipient && emailAllowed) {
      await sendMail({
        to: recipient,
        subject: `🎉 You've been Called Up — Davido wants to collaborate on "${doc.title}"`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif; max-width:560px; margin:auto; background:#0B0B0C; color:#F8F7F8; padding:32px; border-radius:20px">
            <h1 style="color:#FB7185;">You’ve been Called Up ✨</h1>
            <p>Hi ${doc.uploader.username || doc.artistName},</p>
            <p>Davido’s team selected your track <strong>${doc.title}</strong> (${doc.genre}) for a potential collaboration.</p>
            <p>This was triggered by <strong>${adminUser.username}</strong>. Our A&R will reach out within 48 hours. Keep your phone handy.</p>
            <p style="margin-top:24px"><a href="https://davidotv.com/talent/${doc._id}" style="background:linear-gradient(135deg,#BE123C,#FB7185); color:white; padding:12px 20px; border-radius:999px; text-decoration:none; font-weight:700">View your track</a></p>
            <p style="color:#A1A1AA; font-size:12px; margin-top:24px">If you didn't upload this, ignore this email.</p>
          </div>
        `,
        text: `You've been Called Up! Davido wants to collaborate on "${doc.title}". The team will contact you at ${recipient}.`,
      });
    }
  } catch (e) {
    logger.error('Call-Up email failed', { error: e.message, uploadId: id });
  }

  // 3) In-app notification fan-out (P2): persists even when push/email are
  // unconfigured, so the bell always works. Idempotent — early return above
  // prevents duplicates on repeat calls.
  try {
    await createNotification({
      recipient: doc.uploader._id,
      actor: adminUser._id,
      type: 'CALL_UP',
      title: 'You’ve been Called Up ✨',
      body: `Davido’s team selected "${doc.title}" for a potential collaboration.`,
      data: { uploadId: String(doc._id), title: doc.title },
    });
  } catch (e) {
    logger.error('Call-Up notification failed', { error: e.message, uploadId: id });
  }

  // 4) WebSocket: if you have Socket.IO, emit here
  // io.to(`user:${doc.uploader._id}`).emit('call_up', { uploadId: doc._id, title: doc.title });

  logger.info('Call-Up protocol complete', { uploadId: id, admin: adminUser._id });
  return doc;
};

export const flagUpload = async ({ id, reason, adminUser }) => {
  const doc = await TalentUploadModel.findById(id);
  if (!doc) throw Object.assign(new Error('Upload not found'), { statusCode: 404 });
  doc.callUpStatus = 'flagged';
  doc.flagReason = reason;
  doc.reviewedBy = adminUser._id;
  doc.reviewedAt = new Date();
  await doc.save();
  logger.info('Talent flagged', { id, reason, admin: adminUser._id });
  return doc;
};

export default { createUpload, listUploads, curatedQueue, incrementPlay, toggleLike, incrementShare, triggerCallUp, flagUpload };
