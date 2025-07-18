import { YoutubeVideoModel } from './../../youtube/models/youtube.model.js';
import { UserModel } from './../models/user.model.js';
import mongoose from 'mongoose';

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


/**
 * Update user's personal information
 * @param req Express request
 * @param res Express response
 */
export const updatePersonalInfo = async (req, res) => {
    try {
        const { 
            userId,
            name, 
            lastname, 
            // Personal info fields
            phone,
            bio,
            jobTitle,
            educationBackground,
            dob,
            // Address fields
            street,
            city,
            state,
            country
        } = req.body;

        // Validate required fields
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Prepare update object
        const updateData = {};
        
        // Update top-level fields if provided
        if (name) updateData.name = name;
        if (lastname) updateData.lastname = lastname;
        
        // Update personalInfo fields if provided
        updateData.personalInfo = {};
        
        if (phone) updateData.personalInfo.phone = phone;
        if (bio) updateData.personalInfo.bio = bio;
        if (jobTitle) updateData.personalInfo.jobTitle = jobTitle;
        if (educationBackground) updateData.personalInfo.educationBackground = educationBackground;
        if (dob) updateData.personalInfo.dob = new Date(dob);
        
        // Update address fields if provided
        updateData.personalInfo.address = {};
        if (street) updateData.personalInfo.address.street = street;
        if (city) updateData.personalInfo.address.city = city;
        if (state) updateData.personalInfo.address.state = state;
        if (country) updateData.personalInfo.address.country = country;

        // Find and update the user
        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { 
                new: true, 
                runValidators: true,
                // Only return these fields in the response
                select: 'name lastname personalInfo avatar'
            }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Personal information updated successfully',
            data: updatedUser
        });

    } catch (error) {
        console.error('Error updating personal information:', error);

        // Handle specific error types
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error',
                error: error.message 
            });
        }
        
        if (error.name === 'CastError') {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid data format',
                error: error.message 
            });
        }

        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error occurred while updating profile',
            error: error.message 
        });
    }
}


/**
 * Update user's professional information
 * @param req Express request
 * @param res Express response
 */
export const updateProfessioinalInfo = async (req, res) => {
    try {
        const { jobTitle, educationBackground, hobbies, skills, userId } = req.body;

        // Validate required fields
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Find and update the user
        const updatedUser = await UserModel.findByIdAndUpdate(
            userId,
            {
                $set: {
                    'personalInfo.jobTitle': jobTitle,
                    'personalInfo.educationBackground': educationBackground,
                    'professionalInfo.skills': skills,
                    'interests.hobbies': hobbies
                }
            },
            { new: true, runValidators: true }
        ).select('-password -resetToken -resetTokenExpiry');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Professional information updated successfully',
        });

    } catch (error) {
        console.error('Error updating professional information:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
}


/**
 * Update user's username
 * @param req Express request
 * @param res Express response
 */
export const updateUsername = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id, username } = req.body;

        // Validate input
        if (!username || !id) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false, 
                message: "Username and ID are required."
            });
        }

        // Validate username format
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false, 
                message: "Username can only contain letters, numbers, and underscores."
            });
        }

        // Check username length
        if (username.length < 3 || username.length > 30) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Username must be between 3 and 30 characters long."
            });
        }

        // Check if username already exists (case insensitive)
        const existingUser = await UserModel.findOne({ 
            username: { $regex: new RegExp(`^${username}$`, 'i') },
            _id: { $ne: id }
        }).session(session);

        if (existingUser) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ 
                success: false, 
                message: "Username already in use by another user." 
            });
        }

        // Update the user
        const updatedUser = await UserModel.findByIdAndUpdate(
            id,
            { $set: { username } },
            { new: true, runValidators: true, session }
        ).select('-password -resetToken -resetTokenExpiry');

        if (!updatedUser) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false, 
                message: "User not found."
            });
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true, 
            message: "Username updated successfully!",
            data: updatedUser
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        
        console.error('Error updating username:', error);
        
        // Handle specific Mongoose validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false, 
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Update user's testmonial
 * @param req Express request
 * @param res Express response
 */
export const updateTestimonial = async (req, res) => {
  try {
    const { userId, message } = req.body;

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          'testimonial.message': message,
          'testimonial.status': 'pending', // Reset status when updated
          'testimonial.updatedAt': new Date()
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      message: 'Testimonial submitted successfully!',
      success: true,
    });
  } catch (error) {
    console.error('Error updating testimonial:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


/**
 * Get all testimonials with filtering and pagination
 */
export const getAllTestimonials = async (req, res) => {
  try {
    // Extract options from request query
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      sortBy: req.query.sortBy || 'createdAt', // Default sort by createdAt
      sortOrder: req.query.sortOrder || 'desc', // Default sort order is desc for recent first
      status: req.query.status || 'approved',
      search: req.query.search,
      country: req.query.country
    };

    // Set default values
    const page = options.page;
    const limit = options.limit;
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy;
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1; // Will be -1 for 'desc'

    // Build filters
    const filters = {
      'testimonial.message': { $exists: true, $ne: '' }
    };

    // Apply status filter or default to approved
    filters['testimonial.status'] = options.status;

    if (options.search) {
      filters['$or'] = [
        { 'testimonial.message': { $regex: options.search, $options: 'i' } },
        { name: { $regex: options.search, $options: 'i' } },
        { 'personalInfo.jobTitle': { $regex: options.search, $options: 'i' } }
      ];
    }

    if (options.country) {
      filters['testimonial.country'] = options.country;
    }

    // Execute query
    const [testimonials, totalCount] = await Promise.all([
      UserModel.aggregate([
        { $match: filters },
        { $sort: { [`testimonial.${sortBy}`]: sortOrder } }, // This will sort by createdAt: -1 by default
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            name: 1,
            lastname: 1,
            avatar: 1,
            'personalInfo.address.state': 1,
            'personalInfo.address.country': 1,
            'testimonial.message': 1,
            'testimonial.createdAt': 1,
            'testimonial.updatedAt': 1,
          }
        }
      ]),
      UserModel.countDocuments(filters)
    ]);

    return res.status(200).json({
      success: true,
      count: testimonials.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      testimonials: testimonials.map(user => ({
        userId: user._id,
        name: `${user.name} ${user.lastname}`,
        avatar: user.avatar,
        message: user.testimonial.message,
        country: user.personalInfo.address.country,
        state: user.personalInfo.address.state,
        createdAt: user.testimonial.createdAt,
        updatedAt: user.testimonial.updatedAt
      }))
    });

  } catch (error) {
    console.error('Error fetching testimonials:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching testimonials'
    });
  }
};


/**
 * Get pending testimonials for admin review
 */
// export const getPendingTestimonials = async (req, res) => {
//   try {
//     const testimonials = await UserModel.find(
//       { 'testimonial.status': 'pending' },
//       {
//         name: 1,
//         lastname: 1,
//         email: 1,
//         avatar: 1,
//         'personalInfo.jobTitle': 1,
//         'testimonial.message': 1,
//         'testimonial.country': 1,
//         'testimonial.state': 1,
//         'testimonial.createdAt': 1
//       }
//     ).sort({ 'testimonial.createdAt': 1 });

//     return {
//       success: true,
//       count: testimonials.length,
//       testimonials
//     };
//   } catch (error) {
//     console.error('Error fetching pending testimonials:', error);
//     return {
//       success: false,
//       message: 'Server error while fetching pending testimonials'
//     };
//   }
// };

/**
 * Get featured testimonials
 */
// export const getFeaturedTestimonials = async (req, res, limit = 3) => {
//   try {
//     const testimonials = await UserModel.aggregate([
//       {
//         $match: {
//           'testimonial.status': 'approved',
//           'testimonial.isFeatured': true
//         }
//       },
//       { $sample: { size: limit } },
//       {
//         $project: {
//           name: 1,
//           lastname: 1,
//           avatar: 1,
//           'personalInfo.jobTitle': 1,
//           'testimonial.message': 1,
//           'testimonial.country': 1
//         }
//       }
//     ]);

//     return {
//       success: true,
//       testimonials
//     };
//   } catch (error) {
//     console.error('Error fetching featured testimonials:', error);
//     return {
//       success: false,
//       message: 'Server error while fetching featured testimonials'
//     };
//   }
// };