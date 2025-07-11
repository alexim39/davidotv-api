import mongoose from 'mongoose';

/* Schema*/
const userSchema = mongoose.Schema(
    {
        username: {
            type: String,
            unique: true,
            required: [true, "Please enter username"],
        },
        name: {
            type: String,
            required: [true, "Please enter name"]
        },
        lastname: {
            type: String,
            required: [true, "Please enter lastname"]
        },
        email: {
            type: String,
            unique: true,
            required: [true, "Please enter email"],
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"]
        },
        password: {
            type: String,
            required: [true, "Please enter password"]
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user'
        },
        isActive: {
            type: Boolean,
            default: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        avatar: {
            type: String,
            default: 'img/avatar.png'
        },
        library: {
            savedVideos: [{
                savedAt: {
                    type: Date,
                    default: Date.now
                },
                // Additional metadata about the saved video
                videoData: {
                    youtubeVideoId: String,
                    title: String,
                    channel: String,
                    thumbnail: String,
                    duration: String,
                    publishedAt: Date
                }
            }],
            // playlists: [{
            //     playlistId: {
            //         type: mongoose.Schema.Types.ObjectId,
            //         ref: 'Playlist'
            //     },
            //     name: String,
            //     videos: [{
            //         type: mongoose.Schema.Types.ObjectId,
            //         ref: 'Video'
            //     }],
            //     createdAt: {
            //         type: Date,
            //         default: Date.now
            //     }
            // }]
        },
        watchHistory: [{
            watchedAt: {
                type: Date,
                default: Date.now
            },
            watchProgress: {
                type: Number,
                min: 0,
                max: 100,
                default: 0
            },
            // Additional metadata about the watched video
            videoData: {
                youtubeVideoId: String,
                title: String,
                channel: String,
                thumbnail: String,
                duration: String,
                publishedAt: Date
            }
        }],
        preferences: {
            autoplay: {
                type: Boolean,
                default: true
            },
            playbackQuality: {
                type: String,
                enum: ['auto', '144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'],
                default: 'auto'
            },
            theme: {
                type: String,
                enum: ['light', 'dark', 'system'],
                default: 'dark'
            }
        },

        // Forum Activity
        forumActivity: {
            threads: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Thread'
            }],
            comments: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Comment'
            }],
            likedThreads: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Thread'
            }],
            likedComments: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Comment'
            }],
            savedThreads: [{
                thread: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Thread'
                },
                savedAt: {
                type: Date,
                default: Date.now
                }
            }]
            },
            forumPreferences: {
            notificationSettings: {
                threadReplies: {
                type: Boolean,
                default: true
                },
                commentReplies: {
                type: Boolean,
                default: true
                },
                mentions: {
                type: Boolean,
                default: true
                }
            },
            signature: {
                type: String,
                maxlength: [100, "Signature cannot exceed 100 characters"],
                default: ""
            }
            }
        },

    {
        timestamps: true
    }
);

/* Model */
export const UserModel = mongoose.model('User', userSchema);