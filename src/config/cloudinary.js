import { v2 as cloudinary } from 'cloudinary';
import logger from './logger.js';

/**
 * Cloudinary media store — single upload path for ALL user content
 * (talent tracks, covers, avatars, post media, forum media).
 *
 * Auth: the SDK reads CLOUDINARY_URL natively
 * (cloudinary://<key>:<secret>@<cloud>). Folder root: CLOUDINARY_FOLDER.
 * No local disk writes anywhere in the upload path (memoryStorage + stream).
 */

const folderRoot = () => (process.env.CLOUDINARY_FOLDER || 'davidotv').replace(/^\/+|\/+$/g, '');

export const isConfigured = () => !!process.env.CLOUDINARY_URL;

const requireConfigured = () => {
  if (!isConfigured()) {
    throw Object.assign(new Error('Media uploads not configured (CLOUDINARY_URL missing)'), { statusCode: 503 });
  }
};

const resourceTypeFor = (mimetype = '') => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) return 'video'; // Cloudinary serves audio under video
  throw Object.assign(new Error(`Unsupported media type: ${mimetype}`), { statusCode: 400 });
};

/**
 * Upload a multer memory buffer. Returns { url, publicId, resourceType }.
 * Subfolder partitions by domain (talent, avatars, posts, forum) for console sanity.
 */
export const uploadBuffer = (buffer, { mimetype, filename = 'file', subfolder = 'misc' } = {}) =>
  new Promise((resolve, reject) => {
    try {
      requireConfigured();
      const resourceType = resourceTypeFor(mimetype);
      const safe = String(filename).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40) || 'file';
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${folderRoot()}/${subfolder}`,
          resource_type: resourceType,
          public_id: `${Date.now()}-${safe}`,
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload failed', { error: error.message });
            return reject(Object.assign(new Error('Media upload failed, please try again'), { statusCode: 502 }));
          }
          resolve({ url: result.secure_url, publicId: result.public_id, resourceType });
        }
      );
      stream.end(buffer);
    } catch (e) {
      reject(e);
    }
  });

/** Best-effort delete (avatar/cover replacement). Never throws the caller. */
export const deleteAsset = async (publicId, resourceType = 'image') => {
  if (!publicId) return;
  try {
    requireConfigured();
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (e) {
    logger.warn('Cloudinary delete failed', { publicId, error: e.message });
  }
};

export default { isConfigured, uploadBuffer, deleteAsset };
