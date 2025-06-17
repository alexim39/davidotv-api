import { YoutubeVideoModel } from '../models/youtube.model.js';
import mongoose from 'mongoose';

// @desc    Get videos by type
// @route   GET /youtube/videos
// @access  Public
/* export const getVideos = async (req, res) => {
    try {
        const { menuType, isOfficialContent, limit, sort } = req.query;

        console.log(req.query)

        let query = {};
        
        if (menuType === 'music') {
            query = { 
                isOfficialContent: true,
                // Keep the channelId filter but make it optional
                ...(menuType === 'music' && { channelId: 'UCkBV3nBa0iRdxEGc4DUS3xA' })
            };
        } 
        else if (menuType === 'trending') {
            query = { 
                // Less restrictive engagement score
                engagementScore: { $gt: 5000 } 
            };
        }
        else if (menuType === 'videos') {
            query = {
                // For general videos, exclude official music
                isOfficialContent: { $ne: true }
            };
        }

        // Default sort by publishedAt if not specified
        const sortOption = sort || '-publishedAt';
        
        const videos = await YoutubeVideoModel.find(query)
            .sort(sortOption)
            .limit(parseInt(limit) || 12)
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
} */

    // Update the getVideos function in your backend
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
        else if (menuType === 'trending') {
            query = { 
                engagementScore: { $gt: 5000 } 
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
        
        if (mongoose.Types.ObjectId.isValid(req.params.videoId)) {
            video = await YoutubeVideoModel.findById(req.params.videoId).lean().exec();
        } else {
            video = await YoutubeVideoModel.findOne({ 
                youtubeVideoId: req.params.videoId 
            }).lean().exec();
        }
        
        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }
        
        // Add virtual URL field
        const videoWithUrl = {
            ...video,
            url: `https://www.youtube.com/watch?v=${video.youtubeVideoId}`
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