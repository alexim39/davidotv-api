import mongoose from 'mongoose';

/**
 * TalentUpload - Next Global Star
 * Core entity for fan music tracking & analytics.
 */
const talentUploadSchema = new mongoose.Schema(
  {
    artistName: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    genre: { type: String, required: true, trim: true, default: 'Afrobeats', index: true },
    description: { type: String, trim: true, maxlength: 1000 },

    fileUrl: { type: String, required: true }, // Cloudinary secure_url (legacy docs hold /uploads/... paths)
    filePublicId: { type: String }, // Cloudinary public_id for replace/delete
    coverUrl: { type: String },
    coverPublicId: { type: String },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    duration: { type: Number, default: 0 }, // seconds, optional ffprobe

    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Engagement analytics (denormalized)
    plays: { type: Number, default: 0, index: true },
    playedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likeCount: { type: Number, default: 0, index: true },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    shareCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },

    // Moderation pipeline
    callUpStatus: {
      type: String,
      enum: ['pending', 'reviewed', 'called_up', 'flagged'],
      default: 'pending',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    flagReason: { type: String },

    // Call-Up tracking
    calledUpAt: { type: Date },
    calledUpBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Trending ranking index
talentUploadSchema.index({ likeCount: -1, plays: -1, createdAt: -1 });
talentUploadSchema.index({ genre: 1, callUpStatus: 1 });
talentUploadSchema.index({ title: 'text', artistName: 'text', genre: 'text' });

// Virtual: engagementScore for sorting top talent
talentUploadSchema.virtual('engagementScore').get(function () {
  return this.likeCount * 3 + this.plays * 0.7 + this.shareCount * 2 + this.commentCount * 1.5;
});

talentUploadSchema.methods.hasLiked = function (userId) {
  return this.likedBy.some(id => id.equals(userId));
};

export const TalentUploadModel = mongoose.model('TalentUpload', talentUploadSchema);
export default TalentUploadModel;
