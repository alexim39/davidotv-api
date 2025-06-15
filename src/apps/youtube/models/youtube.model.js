import mongoose from 'mongoose';

/* Schema */
const youtubeVideoSchema = mongoose.Schema(
    {
        youtubeVideoId: {
            type: String,
            unique: true,
            required: ['Video ID is require', true],
        },
         title: {
            type: String,
            required: false,
        },   
        channel: {
            type: String,
            required: false,
        },    
        publishedAt: {
            type: String,
            required: true,
        },
        views: {
            type: Number,
            default: 0
        },
        likes: {
            type: Number,
            default: 0
        },
        comments: {
            type: mongoose.Schema.Types.Mixed,
            required: false,
        }
    },
    {
        timestamps: true
    }
);

/* Model */
export const YoutubeVideoModel = mongoose.model('YoutubeVideo', youtubeVideoSchema);