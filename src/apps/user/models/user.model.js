import mongoose from 'mongoose';

const userSchema = mongoose.Schema(
    {
        username: {
            type: String,
            unique: true,
            required: [true, "Please enter username"],
        },
        name: {
            type: String,
            trim: true,
            required: [true, "Please enter name"]
        },
        lastname: {
            type: String,
            trim: true,
            required: [true, "Please enter lastname"]
        },
        email: {
            type: String,
            unique: true,
            trim: true,
            required: [true, "Please enter email"],
            match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, "Please enter a valid email"]
        },
        password: {
            type: String,
            trim: true,
            required: [true, "Please enter password"]
        },
        authenticationMethod: {
            type: String,
            enum: ['local', 'google', 'facebook', 'twitter'],
            default: 'local'
        },
        personalInfo: {
            address: {
                street: { type: String, trim: true },
                city: { type: String, trim: true },
                state: { type: String, trim: true },
                country: { type: String, trim: true }
            },
            phone: { type: String, trim: true },
            dob: { type: Date, trim: true },
            bio: { type: String, trim: true },
            jobTitle: { type: String, trim: true },
            educationBackground: { type: String }
        },
        professionalInfo: {
            skills: [{ type: String }],
            experience: [{
                jobTitle: String,
                company: String,
                startDate: Date,
                endDate: Date,
                description: String,
                current: Boolean
            }],
            education: [{
                institution: String,
                degree: String,
                fieldOfStudy: String,
                startDate: Date,
                endDate: Date,
                description: String
            }]
        },
        interests: {
            hobbies: [{ type: String }],
            favoriteTopics: [{ type: String }]
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user'
        },
        isActive: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false },
        avatar: { type: String, default: 'img/avatar.png' },
        library: {
            savedVideos: [{
                savedAt: { type: Date, default: Date.now },
                videoData: {
                    youtubeVideoId: String,
                    title: String,
                    channel: String,
                    thumbnail: String,
                    duration: String,
                    publishedAt: Date
                }
            }]
        },
        watchHistory: [{
            watchedAt: { type: Date, default: Date.now },
            watchProgress: { type: Number, min: 0, max: 100, default: 0 },
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
            autoplay: { type: Boolean, default: true },
            playbackQuality: {
                type: String,
                enum: ['auto', '144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'],
                default: 'auto'
            },
            theme: {
                type: String,
                enum: ['light', 'dark', 'system'],
                default: 'system'
            },
            notification: { type: Boolean, default: true }
        },
        forumActivity: {
            threads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }],
            comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
            likedThreads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }],
            likedComments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
            savedThreads: [{
                thread: { type: mongoose.Schema.Types.ObjectId, ref: 'Thread' },
                savedAt: { type: Date, default: Date.now }
            }]
        },
        forumPreferences: {
            notificationSettings: {
                threadReplies: { type: Boolean, default: true },
                commentReplies: { type: Boolean, default: true },
                mentions: { type: Boolean, default: true }
            },
            signature: {
                type: String,
                maxlength: [100, "Signature cannot exceed 100 characters"],
                default: ""
            }
        },
        resetToken: { type: String, default: undefined },
        resetTokenExpiry: { type: Date, default: undefined },
        testimonials: [{ 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Testimonial' 
        }],
        testimonialReactions: [{
            testimonial: { type: mongoose.Schema.Types.ObjectId, ref: 'Testimonial' },
            reaction: { type: String, enum: ['like', 'dislike'] },
            createdAt: { type: Date, default: Date.now }
        }],
        // Add shopping-related fields to the existing User model
        shopping: {
            cart: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'ShoppingCart'
            },
            wishlist: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Wishlist'
            },
            purchaseHistory: [{
              type: mongoose.Schema.Types.ObjectId,
              ref: 'Order'
            }],
            paymentMethods: [{
              nickname: String,
              methodType: {
                type: String,
                enum: ['credit_card', 'paypal', 'bank_transfer', 'crypto']
              },
              details: mongoose.Schema.Types.Mixed, // Store encrypted payment details
              isDefault: Boolean
            }],
            preferences: {
              newsletter: {
                type: Boolean,
                default: true
              },
              orderNotifications: {
                type: Boolean,
                default: true
              },
              savePaymentInfo: {
                type: Boolean,
                default: false
              }
            },
        }
    },
    { timestamps: true }
);

export const UserModel = mongoose.model('User', userSchema);