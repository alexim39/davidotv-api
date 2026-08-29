import * as svc from './post.service.js';

export const createPost = async (req,res,next)=>{
  try{
    const { content, tags } = req.body;
    if(!content?.trim()) return res.status(400).json({success:false,message:'Content required'});
    let mediaUrl=null, mediaType=null;
    if(req.file){
      const rel = req.file.path.split('src')[1]?.replace(/\\/g,'/') ?? `/uploads/${req.file.filename}`;
      mediaUrl = rel;
      mediaType = req.file.mimetype.startsWith('image')?'image': req.file.mimetype.startsWith('video')?'video':'audio';
    }
    const data = await svc.create({ author: req.user._id, content, mediaUrl, mediaType, tags });
    res.status(201).json({success:true,data});
  }catch(e){ next(e); }
};

export const getPosts = async (req,res,next)=>{
  try{
    const { page, limit, search } = req.query;
    const result = await svc.list({ page, limit, search });
    res.json({success:true,...result});
  }catch(e){ next(e); }
};

export const likePost = async (req,res,next)=>{
  try{ const r = await svc.toggleLike(req.params.id, req.user._id); res.json({success:true,...r}); }catch(e){ next(e); }
};

export default { createPost, getPosts, likePost };
