import mongoose from 'mongoose';

/* Thread Schema */
const threadSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Thread title is required"],
      maxlength: [200, "Title cannot exceed 200 characters"],
      trim: true
    },
    content: {
      type: String,
      required: [true, "Thread content is required"],
      maxlength: [5000, "Content cannot exceed 5000 characters"]
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function(tags) {
          return tags.length <= 5;
        },
        message: "Cannot add more than 5 tags"
      }
    },
    media: {
      url: {
        type: String,
        required: true
      },
      type: {
        type: String,
        enum: ['image', 'video', 'audio'],
        required: true
      },
      filename: {
        type: String,
        required: true
      },
      originalName: {
        type: String,
        required: true
      },
      size: {
        type: Number,
        required: true
      }
    },
    likeCount: {
      type: Number,
      default: 0
    },
    commentCount: {
      type: Number,
      default: 0
    },
    viewCount: {
      type: Number,
      default: 0
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    category: {
      type: String,
      enum: ['general', 'music', 'videos', 'events', 'questions'],
      default: 'general'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/* Thread Virtuals */
threadSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'thread'
});


/* Indexes */
threadSchema.index({ title: 'text', content: 'text' });
threadSchema.index({ author: 1, createdAt: -1 });

/* Middleware */
// Update comment count when comments are added/deleted
threadSchema.pre('save', function(next) {
  if (this.isModified('commentCount')) {
    this.commentCount = Math.max(0, this.commentCount);
  }
  next();
});

// Cascade delete comments when thread is deleted
threadSchema.pre('deleteOne', { document: true }, async function(next) {
  await this.model('Comment').deleteMany({ thread: this._id });
  next();
});

/* Models */
export const ThreadModel = mongoose.model('Thread', threadSchema);