import multer from 'multer';

/**
 * Multer for ALL user uploads — memory only, no local disk.
 * Files stream straight to Cloudinary via src/config/cloudinary.js
 * (services read req.file.buffer). Limits/filters unchanged:
 * - talent & post/forum media: audio/video (+images for posts/forum), 100MB
 * - avatar: images only, 5MB
 *
 * NOTE: post/forum media accept images too (covers, artwork), so their
 * fileFilter is wider than talent's audio/video-only rule.
 */

const imageFilter = (_req, file, cb) => {
  if (/^image\//.test(file.mimetype)) return cb(null, true);
  return cb(new Error('Only image files allowed for avatar'), false);
};

const mediaFilter = (_req, file, cb) => {
  if (/^(audio|video|image)\//.test(file.mimetype)) return cb(null, true);
  return cb(new Error('Only audio, video or image files allowed'), false);
};

const talentFilter = (_req, file, cb) => {
  if (/^(audio|video)\//.test(file.mimetype)) return cb(null, true);
  return cb(new Error('Only audio/video files allowed'), false);
};

export const uploadTalent = multer({
  storage: multer.memoryStorage(),
  fileFilter: talentFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per spec
});

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadMedia = multer({
  storage: multer.memoryStorage(),
  fileFilter: mediaFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
});

export default { uploadTalent, uploadAvatar, uploadMedia };
