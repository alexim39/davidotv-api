import mongoose from 'mongoose';

const playlistSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Playlist name is required"],
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      maxlength: 500
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    videoIDs: [
      {
        type: String,
        //unique: true,
        required: [true, 'Video ID is required'],
        //index: true
      }
    ],
    isPublic: {
      type: Boolean,
      default: false
    },
    coverImage: {
      type: String
    },
    tags: [{
      type: String
    }],
    collaborators: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    views: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

export const PlaylistModel = mongoose.model('Playlist', playlistSchema);