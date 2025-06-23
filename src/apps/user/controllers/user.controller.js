import { YoutubeVideoModel } from './../../youtube/models/youtube.model.js';
import { UserModel } from './../models/user.model.js';

// @desc    Save video to user's library
// @route   POST /api/users/library/save
// @access  Private
export const saveVideoToLibrary = async (req, res) => {
    try {
        const { userId, videoData } = req.body;

        // Check if video already exists in library
        const user = await UserModel.findById(userId);
        const videoExists = user.library.savedVideos.some(v => v.videoData.youtubeVideoId.toString() === videoData.youtubeVideoId);

        if (videoExists) {
            return res.status(400).json({ 
            success: false,
            message: 'Video already in library' 
            });
        }

        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            {
            $push: {
                'library.savedVideos': {
                videoData
                }
            }
            },
            { new: true, select: '-password' }
        );

        res.status(200).json({
            success: true,
            data: updatedUser.library.savedVideos,
            message: 'Video saved to library!'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }

};

// @desc    Get user's saved videos
// @route   GET /api/users/:userId/library
// @access  Private (user can only access their own library)
export const getSavedVideos = async (req, res) => {
    try {

        const { userId } = req.params;

        const user = await UserModel.findById(userId)
            .select('library.savedVideos')

        if (!user) {
            return res.status(404).json({
            success: false,
            message: 'User not found'
            });
        }

        // Format the response
        const savedVideos = user.library.savedVideos.map(video => ({
            id: video._id,
            savedAt: video.savedAt,
            videoId: video.videoId?._id || video.videoData?.youtubeVideoId,
            ...(video.videoId ? {
            title: video.videoId.title,
            channel: video.videoId.channel,
            thumbnail: video.videoId.thumbnail,
            duration: video.videoId.duration,
            publishedAt: video.videoId.publishedAt
            } : {
            // Fallback to embedded data if video document not found
            title: video.videoData?.title,
            channel: video.videoData?.channel,
            thumbnail: video.videoData?.thumbnail,
            duration: video.videoData?.duration,
            publishedAt: video.videoData?.publishedAt
            })
        }));

        res.status(200).json({
            success: true,
            count: savedVideos.length,
            data: savedVideos
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Remove video from user's library
// @route   DELETE /api/users/library/remove/:userId/:youtubeVideoId
// @access  Private
export const removeVideoFromLibrary = async (req, res) => {
    try {
        const { userId, youtubeVideoId } = req.params;

        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            {
                $pull: {
                    'library.savedVideos': { 
                        'videoData.youtubeVideoId': youtubeVideoId 
                    }
                }
            },
            { new: true, select: '-password' }
        );

        if (!updatedUser) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        res.status(200).json({
            success: true,
            data: updatedUser.library.savedVideos,
            message: 'Video removed from library!'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error',
            error: error.message 
        });
    }
};


// @desc    Get user's watch history
// @route   GET /api/users/:userId/history
// @access  Private
export const getWatchHistory = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await UserModel.findById(userId)
            .select('watchHistory');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Format the response
        const watchHistory = user.watchHistory.map(item => ({
            id: item._id,
            watchedAt: item.watchedAt,
            watchProgress: item.watchProgress,
            videoId: item.videoData?.youtubeVideoId,
            title: item.videoData?.title,
            channel: item.videoData?.channel,
            thumbnail: item.videoData?.thumbnail,
            duration: item.videoData?.duration,
            publishedAt: item.videoData?.publishedAt
        })).sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt)); // Sort by newest first

        res.status(200).json({
            success: true,
            count: watchHistory.length,
            data: watchHistory
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error',
            error: error.message 
        });
    }
};

// @desc    Remove video from watch history
// @route   DELETE /api/users/history/remove/:videoId
// @access  Private
export const removeFromWatchedHistory = async (req, res) => {
    try {
        const { watchedVideoId, userId } = req.params;

        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            {
                $pull: {
                    watchHistory: {
                        $or: [
                            { 'videoData.youtubeVideoId': watchedVideoId },
                        ]
                    }
                }
            },
            { new: true, select: '-password' }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: updatedUser.watchHistory,
            message: 'Video removed from history'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Update watch history
// @route   POST /api/users/history/update
// @access  Private
export const updateWatchHistory = async (req, res) => {
    try {
        const { 
            userId,
            progress,
            youtubeVideoId,
            title,
            channel,
            thumbnail,
            duration,
            publishedAt,
            views,
            likes,
            dislikes
         } = req.body;

        // Validate required fields
        if (!userId || !youtubeVideoId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: userId, videoData, or youtubeVideoId'
            });
        }

        // Find the user and update their watch history
        const user = await UserModel.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if the video already exists in watch history
        const existingVideoIndex = user.watchHistory.findIndex(
            item => item.videoData.youtubeVideoId === youtubeVideoId
        );

        const watchEntry = {
            watchProgress: Math.min(Math.max(progress, 0), 100), // Ensure progress is between 0-100
            videoData: {
                youtubeVideoId,
                title,
                channel,
                thumbnail,
                duration,
                views,
                likes,
                dislikes,
                publishedAt
            }
        };

        if (existingVideoIndex >= 0) {
            // Update existing entry
            user.watchHistory[existingVideoIndex] = {
                ...watchEntry,
                watchedAt: new Date() // Update watch time
            };
        } else {
            // Add new entry
            user.watchHistory.unshift(watchEntry);
            
            // Optional: Limit the size of watch history (e.g., keep last 100 videos)
            if (user.watchHistory.length > 100) {
                user.watchHistory.pop();
            }
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Watch history updated successfully',
            watchHistory: user.watchHistory
        });

    } catch (error) {
        console.error('Error updating watch history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update watch history',
            error: error.message 
        });
    }
};


// @desc    Clear watch history
// @route   DELETE /api/users/history/clear
// @access  Private
export const clearWatchHistory = async (req, res) => {
     try {
        const { userId } = req.params;

        console.log(userId)

        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            { $set: { watchHistory: [] } },
            { new: true, select: '-password' }
        );

        res.status(200).json({
            success: true,
            data: updatedUser.watchHistory,
            message: 'History cleared'
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
  
};