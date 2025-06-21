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

export const YoutubeVideoModel = mongoose.model('YoutubeVideo', youtubeVideoSchema);