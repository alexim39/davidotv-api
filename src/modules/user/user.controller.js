import * as svc from './user.service.js';

export const me = async (req, res, next) => {
  try { const data = await svc.getMe(req.user._id); res.json({ success: true, data }); } catch(e){ next(e); }
};

export const updateProfile = async (req, res, next) => {
  try { const data = await svc.updateProfile(req.user._id, req.body); res.json({ success: true, data }); } catch(e){ next(e); }
};

export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'Avatar file required' });
    const data = await svc.updateAvatar(req.user._id, req.file);
    res.json({ success:true, data });
  } catch(e){ next(e); }
};

export default { me, updateProfile, uploadAvatar };
