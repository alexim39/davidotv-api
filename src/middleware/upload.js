import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload dirs exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

/**
 * Multer storage for talent hub (audio/video) + avatar.
 * - talent: src/uploads/talent/YYYY-MM
 * - avatar: src/uploads/profile/media
 */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Decide by fieldname
    const isAvatar = file.fieldname === 'avatar' || req.originalUrl.includes('/avatar');
    const base = isAvatar
      ? path.join(process.cwd(), 'src', 'uploads', 'profile', 'media')
      : path.join(process.cwd(), 'src', 'uploads', 'talent', new Date().toISOString().slice(0,7));
    ensureDir(base);
    cb(null, base);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safe = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi,'_').slice(0,40);
    cb(null, `${Date.now()}-${safe}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const isAvatar = file.fieldname === 'avatar';
  if (isAvatar) {
    // images only
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    return cb(new Error('Only image files allowed for avatar'), false);
  }
  // talent: audio/video
  if (/^(audio|video)\//.test(file.mimetype)) return cb(null, true);
  return cb(new Error('Only audio/video files allowed'), false);
};

export const uploadTalent = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per spec
});

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export default { uploadTalent, uploadAvatar };
