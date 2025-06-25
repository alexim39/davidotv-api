import mongoose from 'mongoose';

const youtubeVideoSchema = mongoose.Schema(
  {
    // Core YouTube Data
    youtubeVideoId: {
      type: String,
      unique: true,
      required: [true, 'Video ID is required'],
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    channel: {
      type: String,
      required: true
    },
    channelId: {
      type: String,
      required: true,
      index: true
    },
    publishedAt: {
      type: Date,
      required: true,
      index: true
    },
    thumbnail: {
      default: { type: String, required: true },
      medium: { type: String },
      high: { type: String },
      standard: { type: String },
      maxres: { type: String }
    },
    duration: {
      type: String // ISO 8601 duration format (PT1M33S)
    },

    // Engagement Metrics
    views: {
      type: Number,
      default: 0,
      index: true
    },
    appViews: {
      type: Number,
      default: 0,
      index: true
    },
    likes: {
      type: Number,
      default: 0
    },
    dislikes: {
      type: Number,
      default: 0
    },
    commentCount: {
      type: Number,
      default: 0
    },
    engagementScore: {
      type: Number,
      default: 0,
      index: true // For sorting trending content
    },

    // App-Specific Categorization
    menuTypes: {
      type: [String],
      enum: ['trending', 'music', 'videos'],
      default: [],
      index: true
    },
    isOfficialContent: {
      type: Boolean,
      default: false,
      index: true
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true
    },
    tags: {
      type: [String],
      default: []
    },

    // User Interaction Data
    fanFavoritesCount: {
      type: Number,
      default: 0
    },
    sharesCount: {
      type: Number,
      default: 0
    },
    reports: [{
      userId: mongoose.Schema.Types.ObjectId,
      reason: String,
      createdAt: Date
    }],

    // System Metadata
    lastUpdatedFromYouTube: {
      type: Date
    },
    updateHistory: [{
      metrics: {
        views: Number,
        likes: Number,
        dislikes: Number,
        commentCount: Number
      },
      updatedAt: Date
    }],
    shouldTrend: {
      type: Boolean,
      default: false,
      index: true
    },

    // comments
    comments: {
      type: [{
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          auto: true
        },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: 1000
        },
        likes: {
          type: Number,
          default: 0
        },
        likedBy: [{
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }],
        replies: [{
          // Self-referencing for replies
          type: mongoose.Schema.Types.ObjectId
        }],
        parentComment: {
          // Reference to parent comment if this is a reply
          type: mongoose.Schema.Types.ObjectId
        },
        isEdited: {
          type: Boolean,
          default: false
        },
        editHistory: [{
          text: String,
          editedAt: Date
        }],
        isPinned: {
          type: Boolean,
          default: false
        },
        createdAt: {
          type: Date,
          default: Date.now
        },
        updatedAt: {
          type: Date,
          default: Date.now
        }
      }],
      default: []
    },

    // Comment statistics (denormalized for performance)
    commentStats: {
      totalComments: {
        type: Number,
        default: 0
      },
      totalLikes: {
        type: Number,
        default: 0
      },
      topComments: [{
        // References to comment _ids within the embedded array
        type: mongoose.Schema.Types.ObjectId
      }]
    }

  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for optimized queries
youtubeVideoSchema.index({ 
  views: -1, 
  appViews: -1, 
  publishedAt: -1,
  engagementScore: -1 
});

youtubeVideoSchema.index({ 
  channelId: 1, 
  isOfficialContent: 1 
});


// Pre-save hook to calculate engagement score
youtubeVideoSchema.pre('save', function(next) {
  // Simple engagement formula (adjust weights as needed)
  this.engagementScore = Math.round(
    (this.views * 0.5) + 
    (this.likes * 2) + 
    (this.commentCount * 3) -
    (this.dislikes * 1)
  );
  next();
});

// Static method for finding trending videos
youtubeVideoSchema.statics.findTrending = function(limit = 20) {
  return this.find({ menuTypes: 'trending' })
    .sort({ engagementScore: -1, publishedAt: -1 })
    .limit(limit);
};

// Static method for finding official music
youtubeVideoSchema.statics.findOfficialMusic = function(limit = 20) {
  return this.find({ 
    isOfficialContent: true,
    menuTypes: 'music'
  })
  .sort({ publishedAt: -1 })
  .limit(limit);
};

// In your Mongoose model (youtube.model.js)
youtubeVideoSchema.index({
    title: 'text',
    description: 'text',
    tags: 'text',
    channel: 'text' // Add this line
});

// Update pre-save hook to maintain comment stats
youtubeVideoSchema.pre('save', function(next) {
  // Update comment count
  this.commentStats.totalComments = this.comments.length;
  
  // Update total likes
  this.commentStats.totalLikes = this.comments.reduce((sum, comment) => sum + comment.likes, 0);
  
  // Update top comments (most liked, limit to 3)
  this.commentStats.topComments = [...this.comments]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 3)
    .map(comment => comment._id);
  
  // Update engagement score with comment metrics
  this.engagementScore = Math.round(
    (this.views * 0.5) + 
    (this.likes * 2) + 
    (this.commentStats.totalComments * 3) +
    (this.commentStats.totalLikes * 0.5) -
    (this.dislikes * 1)
  );
  
  next();
});

// Add method to add a comment
youtubeVideoSchema.methods.addComment = function(userId, userAvatar, username, text) {
  const newComment = {
    userId,
    userAvatar,
    username,
    text,
    likes: 0,
    likedBy: [],
    replies: [],
    isEdited: false,
    isPinned: false
  };
  
  this.comments.unshift(newComment); // Add to beginning for newest first
  return this.save();
};

// Add method to like a comment
youtubeVideoSchema.methods.likeComment = function(commentId, userId) {
  const comment = this.comments.id(commentId);
  if (!comment) throw new Error('Comment not found');
  
  // Check if user already liked
  const alreadyLiked = comment.likedBy.some(id => id.equals(userId));
  if (alreadyLiked) {
    throw new Error('User already liked this comment');
  }
  
  comment.likes += 1;
  comment.likedBy.push(userId);
  return this.save();
};

// Add method to reply to a comment
youtubeVideoSchema.methods.addReply = function(parentCommentId, userId, userAvatar, username, text) {
  const parentComment = this.comments.id(parentCommentId);
  if (!parentComment) throw new Error('Parent comment not found');
  
  const newReply = {
    userId,
    userAvatar,
    username,
    text,
    likes: 0,
    likedBy: [],
    parentComment: parentCommentId,
    isEdited: false,
    isPinned: false
  };
  
  const reply = this.comments.create(newReply);
  this.comments.push(reply);
  parentComment.replies.push(reply._id);
  
  return this.save();
};


export const YoutubeVideoModel = mongoose.model('YoutubeVideo', youtubeVideoSchema);