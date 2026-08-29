import { PostModel } from './post.model.js';

export const create = async ({ author, content, mediaUrl, mediaType, tags }) => {
  return PostModel.create({ author, content, mediaUrl, mediaType, tags });
};

export const list = async ({ page=1, limit=12, search }) => {
  const q = { isDeleted: false };
  if (search) q.$text = { $search: search };
  const pg = Math.max(1, parseInt(page)), lim = Math.min(50, parseInt(limit));
  const sort = search ? { score: { $meta:'textScore' } } : { createdAt: -1 };
  const sel = search ? { score: { $meta:'textScore' } } : {};
  const [data,total] = await Promise.all([
    PostModel.find(q, sel).sort(sort).skip((pg-1)*lim).limit(lim).populate('author','username avatar name lastname').lean(),
    PostModel.countDocuments(q)
  ]);
  return { data, total, page: pg, limit: lim, totalPages: Math.ceil(total/lim) };
};

export const toggleLike = async (postId, userId) => {
  const post = await PostModel.findById(postId);
  if (!post) throw Object.assign(new Error('Post not found'), {statusCode:404});
  const idx = post.likes.findIndex(id=> id.equals(userId));
  if (idx>-1){ post.likes.splice(idx,1); post.likeCount=Math.max(0,post.likeCount-1); }
  else { post.likes.push(userId); post.likeCount+=1; }
  await post.save();
  return { liked: idx===-1, likeCount: post.likeCount };
};

export default { create, list, toggleLike };
