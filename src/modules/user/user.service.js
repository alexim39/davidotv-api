import { UserModel } from '../../apps/user/models/user.model.js';
import logger from '../../config/logger.js';
import { uploadBuffer, deleteAsset } from '../../config/cloudinary.js';

export const getMe = async (userId) => {
  const user = await UserModel.findById(userId).select('-password').lean();
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user;
};

export const updateProfile = async (userId, payload) => {
  const allowed = ['personalInfo','professionalInfo','interests','name','lastname','bio'];
  const update = {};
  for (const k of allowed) if (payload[k] !== undefined) update[k]=payload[k];
  // flat personalInfo support
  if (payload.bio || payload.jobTitle) {
    update['personalInfo.bio'] = payload.bio;
    update['personalInfo.jobTitle'] = payload.jobTitle;
  }
  const user = await UserModel.findByIdAndUpdate(userId, { $set: payload }, { new: true, runValidators: true }).select('-password');
  logger.info('Profile updated', { userId });
  return user;
};

export const updateAvatar = async (userId, file) => {
  // Cloudinary straight from the memory buffer; old asset removed by publicId.
  const current = await UserModel.findById(userId).select('avatarPublicId').lean();
  const up = await uploadBuffer(file.buffer, {
    mimetype: file.mimetype,
    filename: file.originalname,
    subfolder: 'avatars',
  });
  await deleteAsset(current?.avatarPublicId, 'image');
  const user = await UserModel.findByIdAndUpdate(
    userId,
    { avatar: up.url, avatarPublicId: up.publicId },
    { new: true }
  ).select('-password');
  logger.info('Avatar updated', { userId });
  return user;
};

export default { getMe, updateProfile, updateAvatar };
