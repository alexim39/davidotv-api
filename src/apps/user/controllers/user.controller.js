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
  
        // Verify the requesting user has access to this library
       /*  if (req.user._id.toString() !== userId) {
            return res.status(403).json({
            success: false,
            message: 'Not authorized to access this library'
            });
        } */

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


// @desc    Update watch history
// @route   POST /api/users/history/update
// @access  Private
export const updateWatchHistory = async (req, res) => {
     try {
         const { videoId, progress, videoData } = req.body;
        const userId = req.user._id;

        // Find existing history entry
        const user = await UserModel.findById(userId);
        const existingEntry = user.watchHistory.find(entry => entry.videoId.toString() === videoId);

        if (existingEntry) {
            // Update existing entry
            existingEntry.watchedAt = new Date();
            existingEntry.watchProgress = Math.max(progress, existingEntry.watchProgress);
            existingEntry.videoData = videoData;
        } else {
            // Add new entry
            user.watchHistory.push({
            videoId,
            watchProgress: progress,
            videoData
            });
        }

        // Keep only the last 100 history items (adjust as needed)
        if (user.watchHistory.length > 100) {
            user.watchHistory = user.watchHistory.slice(-100);
        }

        await user.save();

        res.status(200).json({
            success: true,
            data: user.watchHistory
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
 
};

// @desc    Clear watch history
// @route   DELETE /api/users/history/clear
// @access  Private
export const clearWatchHistory = async (req, res) => {
     try {
        const userId = req.user._id;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: { watchHistory: [] } },
            { new: true, select: '-password' }
        );

        res.status(200).json({
            success: true,
            data: updatedUser.watchHistory
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
  
};