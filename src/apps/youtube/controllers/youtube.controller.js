import { YoutubeVideoModel } from '../models/youtube.model.js';
import mongoose from 'mongoose';
import { UserModel } from '../../user/models/user.model.js';

// @desc    Get videos by type
// @route   GET /youtube/videos
// @access  Public
export const getVideos = async (req, res) => {
    try {
        const { menuType, isOfficialContent, limit, page = 0, sort } = req.query;
        const officialChannelIds = process.env.OFFICIAL_CHANNEL_IDS ? 
            process.env.OFFICIAL_CHANNEL_IDS.split(',') : 
            ['UCkBV3nBa0iRdxEGc4DUS3xA', 'UCQJOYS9v30qM74f6gZDk0TA']; // Default fallback

        let query = {};
        
        if (menuType === 'music') {
            query = { 
                isOfficialContent: true,
                channelId: { $in: officialChannelIds } // Check against all official channels
            };
        } 
        else if (menuType === 'trending') {
            query = { 
                $or: [
                    { engagementScore: { $gt: 5000 } },
                    { shouldTrend: true }
                ]
            };
        }
        else if (menuType === 'videos') {
            query = {
                isOfficialContent: false,
                channelId: { $nin: officialChannelIds } // Exclude all official channels
            };
        }

        // Additional filtering if isOfficialContent is specified
        if (isOfficialContent === 'true') {
            query.isOfficialContent = true;
            query.channelId = { $in: officialChannelIds };
        } else if (isOfficialContent === 'false') {
            query.isOfficialContent = false;
            query.channelId = { $nin: officialChannelIds };
        }

        const sortOption = sort || '-publishedAt';
        const limitValue = parseInt(limit) || 12;
        const skipValue = parseInt(page) * limitValue;
        
        const videos = await YoutubeVideoModel.find(query)
            .sort(sortOption)
            .skip(skipValue)
            .limit(limitValue)
            .lean();

        res.status(200).json({
            success: true,
            data: videos.map(v => ({
                ...v,
                url: `https://www.youtube.com/watch?v=${v.youtubeVideoId}`
            }))
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

// @desc    Get single video by ID
// @route   GET /youtube/videos/:id
// @access  Public
export const getVideoById = async (req, res) => {
    try {
        let video;
        let updateQuery;
        const officialChannelIds = process.env.OFFICIAL_CHANNEL_IDS ? 
            process.env.OFFICIAL_CHANNEL_IDS.split(',') : 
            ['UCkBV3nBa0iRdxEGc4DUS3xA', 'UCQJOYS9v30qM74f6gZDk0TA']; // Default fallback
        
        if (mongoose.Types.ObjectId.isValid(req.params.videoId)) {
            video = await YoutubeVideoModel.findById(req.params.videoId).lean().exec();
            updateQuery = { _id: req.params.videoId };
        } else {
            video = await YoutubeVideoModel.findOne({ 
                youtubeVideoId: req.params.videoId 
            }).lean().exec();
            updateQuery = { youtubeVideoId: req.params.videoId };
        }
        
        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }
        
        // Add isOfficial flag based on channel ID
        const videoWithOfficialFlag = {
            ...video,
            isOfficialContent: officialChannelIds.includes(video.channelId)
        };
        
        // Increment views count
        const updatedVideo = await YoutubeVideoModel.findOneAndUpdate(
            updateQuery,
            { $inc: { appViews: 1 } },
            { new: true }
        ).lean();
        
        const videoWithUrl = {
            ...updatedVideo,
            url: `https://www.youtube.com/watch?v=${updatedVideo.youtubeVideoId}`,
            isOfficialContent: officialChannelIds.includes(updatedVideo.channelId)
        };
        
        res.status(200).json({success: true, data: videoWithUrl});

    } catch (error) {
        console.error('Error in getVideoById:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

export const searchVideos = async (req, res) => {
    try {
        const { search, limit = 12, page = 0, sort = '-publishedAt', isOfficial } = req.query;
        const officialChannelIds = process.env.OFFICIAL_CHANNEL_IDS ? 
            process.env.OFFICIAL_CHANNEL_IDS.split(',') : 
            ['UCkBV3nBa0iRdxEGc4DUS3xA', 'UCQJOYS9v30qM74f6gZDk0TA'];

        if (!search || typeof search !== 'string' || search.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const searchQuery = search.trim();
        const limitValue = parseInt(limit);
        const skipValue = parseInt(page) * limitValue;

        // Build base query
        let baseQuery = { $text: { $search: searchQuery } };
        
        // Add official content filter if specified
        if (isOfficial === 'true') {
            baseQuery.channelId = { $in: officialChannelIds };
        } else if (isOfficial === 'false') {
            baseQuery.channelId = { $nin: officialChannelIds };
        }

        // 1. First try text search (if text index exists)
        const videos = await YoutubeVideoModel.find(
            baseQuery,
            { score: { $meta: "textScore" } }
        )
        .sort({ score: { $meta: "textScore" }, publishedAt: -1 })
        .skip(skipValue)
        .limit(limitValue)
        .lean();

        // 2. If no results, fallback to regex search including channel name
        let results = videos;
        if (videos.length === 0) {
            const regex = new RegExp(searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
            
            let fallbackQuery = {
                $or: [
                    { title: regex },
                    { description: regex },
                    { tags: regex },
                    { channel: regex }
                ]
            };
            
            // Apply official filter to fallback query if specified
            if (isOfficial === 'true') {
                fallbackQuery.channelId = { $in: officialChannelIds };
            } else if (isOfficial === 'false') {
                fallbackQuery.channelId = { $nin: officialChannelIds };
            }
            
            results = await YoutubeVideoModel.find(fallbackQuery)
                .sort(sort)
                .skip(skipValue)
                .limit(limitValue)
                .lean();
        }

        // Count total matching documents
        const countQuery = videos.length > 0 ? baseQuery : {
            $or: [
                { title: new RegExp(searchQuery, 'i') },
                { description: new RegExp(searchQuery, 'i') },
                { tags: new RegExp(searchQuery, 'i') },
                { channel: new RegExp(searchQuery, 'i') }
            ]
        };
        
        // Apply official filter to count query if specified
        if (isOfficial === 'true') {
            countQuery.channelId = { $in: officialChannelIds };
        } else if (isOfficial === 'false') {
            countQuery.channelId = { $nin: officialChannelIds };
        }

        const total = await YoutubeVideoModel.countDocuments(countQuery);

        // Add isOfficialContent flag to each result
        const resultsWithFlags = results.map(v => ({
            ...v,
            isOfficialContent: officialChannelIds.includes(v.channelId),
            url: `https://www.youtube.com/watch?v=${v.youtubeVideoId}`
        }));

        res.status(200).json({
            success: true,
            data: resultsWithFlags,
            meta: {
                query: searchQuery,
                count: results.length,
                total,
                page: parseInt(page),
                limit: limitValue,
                totalPages: Math.ceil(total / limitValue)
            }
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during search',
            error: error.message 
        });
    }
}

export const getPlaylistVideos = async (req, res) => {
    try {
        const { 
            page = 1, 
            pageSize = 10, 
            menuType, 
            sort = '-publishedAt',
            isOfficial 
        } = req.query;
        
        const officialChannelIds = process.env.OFFICIAL_CHANNEL_IDS ? 
            process.env.OFFICIAL_CHANNEL_IDS.split(',') : 
            ['UCkBV3nBa0iRdxEGc4DUS3xA', 'UCQJOYS9v30qM74f6gZDk0TA'];

        const pageNum = Math.max(parseInt(page), 1);
        let pageSizeNum = Math.min(Math.max(parseInt(pageSize), 1), 50);

        let filter = menuType ? { menuTypes: menuType } : {};
        
        // Add official content filter if specified
        if (isOfficial === 'true') {
            filter.channelId = { $in: officialChannelIds };
        } else if (isOfficial === 'false') {
            filter.channelId = { $nin: officialChannelIds };
        }
        
        const totalCount = await YoutubeVideoModel.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSizeNum);
        
        const hasNextPage = pageNum < totalPages;
        
        const videos = await YoutubeVideoModel.find(filter)
            .sort(sort === 'views' ? { views: -1 } : 
                 sort === 'engagementScore' ? { engagementScore: -1 } : 
                 { publishedAt: -1 })
            .skip((pageNum - 1) * pageSizeNum)
            .limit(pageSizeNum)
            .lean();

        // Add isOfficialContent flag to each video
        const videosWithFlags = videos.map(v => ({
            ...v,
            isOfficialContent: officialChannelIds.includes(v.channelId)
        }));

        res.status(200).json({
            success: true,
            data: videosWithFlags,
            pagination: {
                currentPage: pageNum,
                pageSize: pageSizeNum,
                totalPages,
                totalCount,
                hasNextPage
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error',
            error: error.message 
        });
    }
}

export const addComment = async (req, res) => {
    try {
        const { userId, videoId, text } = req.body;

        if (!userId || !videoId || !text) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: userId, videoId, or text'
            });
        }

        const video = await YoutubeVideoModel.findOne({ youtubeVideoId: videoId });
        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const newComment = {
            userId,
            text,
            likes: 0,
            likedBy: [],
            replies: [],
            isEdited: false,
            isPinned: false,
        };

        video.comments.unshift(newComment);
        video.commentCount = video.comments.length;

        await video.save();

        res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            comment: newComment,
            videoId: video.youtubeVideoId
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error',
            error: error.message 
        });
    }
}


  export const likeVideo = async (req, res) => {
    try {
        const { userId, videoId } = req.body;

        console.log('Like Video Request:', { userId, videoId });

        // Find video by youtubeVideoId
        const video = await YoutubeVideoModel.findOne({ youtubeVideoId: videoId });
        if (!video) {
            return res.status(404).json({ success: false, message: 'Video not found' });
        }

        // Convert userId to ObjectId if needed
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

        // Check if user already liked
        const userIndex = video.appLikedBy.findIndex(id => id.equals(userObjectId));
        let liked = false;

        if (userIndex === -1) {
            // Add like
            video.appLikedBy.push(userObjectId);
            video.appLikes += 1;

            // Remove dislike if exists
            const dislikeIndex = video.appDislikedBy.findIndex(id => id.equals(userObjectId));
            if (dislikeIndex !== -1) {
                video.appDislikedBy.splice(dislikeIndex, 1);
                video.appDislikes -= 1;
            }

            liked = true;
        } else {
            // Remove like
            video.appLikedBy.splice(userIndex, 1);
            video.appLikes -= 1;
        }

        await video.save();

        res.status(200).json({
            success: true,
            message: liked ? 'Liked video' : 'Unliked video',
            liked,
            disliked: video.appDislikedBy.some(id => id.equals(userObjectId)),
            appLikes: video.appLikes,
            appDislikes: video.appDislikes
        });

    } catch (error) {
        console.error('Error liking video:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}


  export const dislikeVideo = async (req, res) => {
    try {
        const { userId, videoId } = req.body;

        // Find video by youtubeVideoId
        const video = await YoutubeVideoModel.findOne({ youtubeVideoId: videoId });
        if (!video) {
            return res.status(404).json({ success: false, message: 'Video not found' });
        }

        // Convert userId to ObjectId if needed
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

        // Check if user already disliked
        const userIndex = video.appDislikedBy.findIndex(id => id.equals(userObjectId));
        let disliked = false;

        if (userIndex === -1) {
            // Add dislike
            video.appDislikedBy.push(userObjectId);
            video.appDislikes += 1;

            // Remove like if exists
            const likeIndex = video.appLikedBy.findIndex(id => id.equals(userObjectId));
            if (likeIndex !== -1) {
                video.appLikedBy.splice(likeIndex, 1);
                video.appLikes -= 1;
            }

            disliked = true;
        } else {
            // Remove dislike
            video.appDislikedBy.splice(userIndex, 1);
            video.appDislikes -= 1;
        }

        await video.save();

        res.status(200).json({
            success: true,
            message: disliked ? 'Disliked video' : 'Undisliked video',
            liked: video.appLikedBy.some(id => id.equals(userObjectId)),
            disliked,
            appLikes: video.appLikes,
            appDislikes: video.appDislikes
        });

    } catch (error) {
        console.error('Error disliking video:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}