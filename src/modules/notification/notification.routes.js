import { Router } from 'express';
import { protect } from '../../middleware/auth.js';
import * as svc from './notification.service.js';

const router = Router();

router.get('/', protect, async (req,res,next)=>{
  try{ const r= await svc.listForUser(req.user._id, req.query); res.json({success:true,...r}); }catch(e){ next(e); }
});

// NOTE: /read-all MUST precede /:id/read — Express matches in order (discovery ME-06).
router.patch('/read-all', protect, async (req,res,next)=>{
  try{ await svc.markAllRead(req.user._id); res.json({success:true}); }catch(e){ next(e); }
});

router.patch('/:id/read', protect, async (req,res,next)=>{
  try{ const n= await svc.markRead(req.user._id, req.params.id); res.json({success:true,data:n}); }catch(e){ next(e); }
});

// NOT-01: own channel/type preferences (in-app bell cannot be muted).
router.get('/preferences', protect, async (req,res,next)=>{
  try{ const p = await svc.getPreferences(req.user._id); res.json({success:true,data:p}); }catch(e){ next(e); }
});

router.put('/preferences', protect, async (req,res,next)=>{
  try{ const p = await svc.updatePreferences(req.user._id, req.body); res.json({success:true,data:p}); }catch(e){ next(e); }
});

export default router;
