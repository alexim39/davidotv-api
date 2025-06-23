import { YoutubeVideoModel } from '../models/youtube.model.js';
import mongoose from 'mongoose';
import { UserModel } from '../../user/models/user.model.js';

// @desc    Get videos by type
// @route   GET /youtube/videos
// @access  Public
export const getVideos = async (req, res) => {
    try {
        const { menuType, isOfficialContent, limit, page = 0, sort } = req.query;

        let query = {};
        
        if (menuType === 'music') {
            query = { 
                isOfficialContent: true,
                ...(menuType === 'music' && { channelId: 'UCkBV3nBa0iRdxEGc4DUS3xA' })
            };
        } 
        // else if (menuType === 'trending') {
        //     query = { 
        //         engagementScore: { $gt: 5000 } 
        //     };
        // }
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
                isOfficialContent: { $ne: true }
            };
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
        
        // Increment views count - use findOneAndUpdate to get the updated document
        const updatedVideo = await YoutubeVideoModel.findOneAndUpdate(
            updateQuery,
            { $inc: { appViews: 1 } },
            { new: true } // Return the updated document
        ).lean();
        
        // Add virtual URL field
        const videoWithUrl = {
            ...updatedVideo,
            url: `https://www.youtube.com/watch?v=${updatedVideo.youtubeVideoId}`
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
        const { search, limit = 12, page = 0, sort = '-publishedAt' } = req.query;

        if (!search || typeof search !== 'string' || search.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const searchQuery = search.trim();
        const limitValue = parseInt(limit);
        const skipValue = parseInt(page) * limitValue;

        // 1. First try text search (if text index exists)
        const videos = await YoutubeVideoModel.find(
            { $text: { $search: searchQuery } },
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
            results = await YoutubeVideoModel.find({
                $or: [
                    { title: regex },
                    { description: regex },
                    { tags: regex },
                    { channel: regex } // Added channel name to search
                ]
            })
            .sort(sort)
            .skip(skipValue)
            .limit(limitValue)
            .lean();
        }

        // Count total matching documents
        const total = await YoutubeVideoModel.countDocuments(
            videos.length > 0 ? 
            { $text: { $search: searchQuery } } : 
            { $or: [
                { title: new RegExp(searchQuery, 'i') },
                { description: new RegExp(searchQuery, 'i') },
                { tags: new RegExp(searchQuery, 'i') },
                { channel: new RegExp(searchQuery, 'i') } // Include channel in count too
            ]}
        );

        res.status(200).json({
            success: true,
            data: results.map(v => ({
                ...v,
                url: `https://www.youtube.com/watch?v=${v.youtubeVideoId}`
            })),
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
            sort = '-publishedAt'
        } = req.query;

        const pageNum = Math.max(parseInt(page), 1);
        let pageSizeNum = Math.min(Math.max(parseInt(pageSize), 1), 50);

        const filter = menuType ? { menuTypes: menuType } : {};
        
        const totalCount = await YoutubeVideoModel.countDocuments(filter);
        const totalPages = Math.ceil(totalCount / pageSizeNum);
        
        // More accurate hasNextPage calculation
        const hasNextPage = pageNum < totalPages;
        
        const videos = await YoutubeVideoModel.find(filter)
            .sort(sort === 'views' ? { views: -1 } : 
                 sort === 'engagementScore' ? { engagementScore: -1 } : 
                 { publishedAt: -1 })
            .skip((pageNum - 1) * pageSizeNum)
            .limit(pageSizeNum)
            .lean();

        res.status(200).json({
            success: true,
            data: videos,
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

        // Validate required fields
        if (!userId || !videoId || !text) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: userId, videoId, or text'
            });
        }

        // Find the video
        const video = await YoutubeVideoModel.findOne({ youtubeVideoId: videoId });
        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Get user details (assuming you have a User model)
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Create new comment
        const newComment = {
            userId,
            text,
            likes: 0,
            likedBy: [],
            replies: [],
            isEdited: false,
            isPinned: false,
        };

        // Add comment to video
        video.comments.unshift(newComment);
        video.commentCount = video.comments.length;

        // Save the video with the new comment
        await video.save();

        // Return success response with the new comment
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