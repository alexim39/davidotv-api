
import { YoutubeVideoModel } from '../models/youtube.model.js';

export const addVideos = async (req, res) => {
    try {
        let videos = req.body;

        // Ensure input is always an array
        if (!Array.isArray(videos)) {
            videos = [videos];
        }

        // Validate required fields for each video
        for (const video of videos) {
            if (!video.youtubeVideoId) {
                return res.status(400).json({
                    success: false,
                    message: "Each video must have a youtubeVideoId"
                });
            }
        }

        // Get all youtubeVideoIds from the request
        const videoIds = videos.map(v => v.youtubeVideoId);

        // Find existing videos in the database
        const existingVideos = await YoutubeVideoModel.find({
            youtubeVideoId: { $in: videoIds }
        }).select('youtubeVideoId');

        const existingIds = existingVideos.map(v => v.youtubeVideoId);

        // Filter out videos with duplicate youtubeVideoId
        const newVideos = videos.filter(v => !existingIds.includes(v.youtubeVideoId));

        if (newVideos.length === 0) {
            return res.status(409).json({
                success: false,
                message: 'All provided videos already exist in the database.'
            });
        }

        // Insert only new videos
        YoutubeVideoModel.insertMany(newVideos);

        res.status(200).json({
            success: true,
            message: 'Videos uploaded successfully',
            //insertedCount: insertedVideos.length,
            skippedCount: videos.length - newVideos.length,
            skippedIds: existingIds
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

export const getAllVideos = async (req, res) => {
    try {
        const videos = await YoutubeVideoModel.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: videos
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

export const getVideoById = async (req, res) => {
    try {
        const { youtubeVideoId } = req.params;

        if (!youtubeVideoId) {
            return res.status(400).json({
                success: false,
                message: "Video Id is required"
            });
        }

        const video = await YoutubeVideoModel.findOne({ youtubeVideoId });

        if (!video) {
            return res.status(404).json({
                success: false,
                message: "Video not found"
            });
        }

        res.status(200).json({
            success: true,
            data: video
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}