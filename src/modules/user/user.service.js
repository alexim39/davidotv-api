import { UserModel } from '../../apps/user/models/user.model.js';
import logger from '../../config/logger.js';

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
  const rel = file.path.split('src')[1]?.replace(/\\/g,'/') ?? `/uploads/profile/media/${file.filename}`;
  const avatar = rel.startsWith('/uploads') ? rel : `/uploads/profile/media/${file.filename}`;
  const user = await UserModel.findByIdAndUpdate(userId, { avatar }, { new: true }).select('-password');
  return user;
};

export default { getMe, updateProfile, updateAvatar };
