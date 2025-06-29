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

/* Comment Schema */
const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, "Comment content is required"],
      maxlength: [2000, "Comment cannot exceed 2000 characters"]
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    thread: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Thread',
      required: true
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment'
    },
    likeCount: {
      type: Number,
      default: 0
    },
    isDeleted: {
      type: Boolean,
      default: false
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

/* Comment Virtuals */
commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment'
});

/* Indexes */
threadSchema.index({ title: 'text', content: 'text' });
threadSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ thread: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });

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
export const CommentModel = mongoose.model('Comment', commentSchema);