import mongoose from 'mongoose';

/**
 * Post - Community feed (renamed from legacy feed/forum).
 * Shared schema for fan interactions around talent & Davido content.
 */
const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  mediaUrl: { type: String },
  mediaType: { type: String, enum: ['image','video','audio', null], default: null },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  likeCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  tags: [{ type: String }],
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ content: 'text' });

export const PostModel = mongoose.model('Post', postSchema);
export default PostModel;
