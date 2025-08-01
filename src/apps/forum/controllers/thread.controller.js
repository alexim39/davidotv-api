import { UserModel } from '../../user/models/user.model.js';
import { ThreadModel } from './../models/thread.model.js';
import { CommentModel } from '../models/comment.model.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';


// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Corrected path to align with express.static middleware
    const uploadDir = 'src/uploads/forum/media'; 
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter to accept only certain media types
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || 
      file.mimetype.startsWith('video/') || 
      file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

// Configure multer upload middleware
const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
}).single('media');

/**
 * @desc    Create a new forum thread with optional media
 */
export const createThread = async (req, res) => {
  try {
    // First handle the file upload
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      // Extract other form fields
      const { title, content, tags, authorId } = req.body;
      
      // Prepare thread data
      const threadData = {
        title,
        content,
        author: authorId,
        tags: JSON.parse(tags || '[]')
      };

      // If file was uploaded, add media info
      if (req.file) {
        threadData.media = {
          url: `/uploads/forum/media/${req.file.filename}`,
          type: req.file.mimetype.split('/')[0], // 'image', 'video', or 'audio'
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size
        };
      }

      // Create new thread
      const newThread = new ThreadModel(threadData);

      // Save thread
      const savedThread = await newThread.save();

      // Update user's forum activity
      await UserModel.findByIdAndUpdate(newThread.author, {
        $push: { 'forumActivity.threads': savedThread._id }
      });

      // Populate author info before sending response
      const populatedThread = await ThreadModel.findById(savedThread._id)
        .populate('author', 'name username avatar');

      res.status(201).json({
        success: true,
        data: populatedThread,
        message: 'Thread created successfully'
      });
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create thread',
      error: error.message
    });
  }
};


/**
* @desc    Get all forum threads with pagination, sorting, and filtering
 */
export const getThreads = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Sorting parameters
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    // Filtering
    const filters = {};
    if (req.query.category) {
      filters.category = req.query.category;
    }
    if (req.query.tag) {
      filters.tags = req.query.tag;
    }
    if (req.query.search) {
      filters.$text = { $search: req.query.search };
    }

    // Get threads with pagination and sorting
    const threads = await ThreadModel.find(filters)
      .sort({ [sortBy]: sortOrder, _id: 1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'name username avatar')
      .select('-__v') // Exclude version key
      .lean();

    // Get total count for pagination
    const totalThreads = await ThreadModel.countDocuments(filters);

    res.status(200).json({
      success: true,
      data: threads,
      pagination: {
        page,
        limit,
        total: totalThreads,
        totalPages: Math.ceil(totalThreads / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch threads',
      error: error.message
    });
  }
};


/**
 * @desc    Get a single thread by ID with comments and replies
  */
export const getThreadById = async (req, res) => {
  try {
    const threadId = req.params.id;

    // Get thread with author populated
    const thread = await ThreadModel.findById(threadId)
      .populate('author', 'name username avatar')
      .select('-__v') // Exclude version key
      .lean();

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // Get comments with authors and replies populated
    const comments = await CommentModel.find({ thread: threadId, parentComment: null })
      .populate('author', 'name username avatar')
      .populate({
        path: 'replies',
        populate: { path: 'author', select: 'name username avatar' }
      })
      .select('-__v') // Exclude version key
      .lean();

    // Increment view count (async without waiting)
    ThreadModel.findByIdAndUpdate(threadId, { $inc: { viewCount: 1 } }).exec();

    res.status(200).json({
      success: true,
      data: {
        ...thread,
        comments
      }
    });

  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch thread',
      error: error.message
    });
  }
};


/**
 * @desc    Toggle like on a thread
 * @route   PUT /api/forum/threads/:threadId/like
 * @access  Private
 */
export const toggleThreadLike = async (req, res) => {
  try {
    const { threadId, userId } = req.body;

    // 1. Validate the thread exists
    const thread = await ThreadModel.findById(threadId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    // 2. Check if user already liked the thread
    const user = await UserModel.findById(userId);
    const alreadyLiked = user.forumActivity.likedThreads.includes(threadId);

    let updatedThread;
    let updatedUser;

    if (alreadyLiked) {
      // 3a. Remove like
      updatedThread = await ThreadModel.findByIdAndUpdate(
        threadId,
        {
          $inc: { likeCount: -1 },
          $pull: { likedBy: userId }
        },
        { new: true }
      )
      .populate('author', 'name username avatar')
      .select('-__v'); // Exclude version key

      updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        {
          $pull: { 'forumActivity.likedThreads': threadId }
        },
        { new: true }
      );
    } else {
      // 3b. Add like
      updatedThread = await ThreadModel.findByIdAndUpdate(
        threadId,
        {
          $inc: { likeCount: 1 },
          $addToSet: { likedBy: userId }
        },
        { new: true }
      )
      .populate('author', 'name username avatar')
      .select('-__v'); // Exclude version key

      updatedUser = await UserModel.findByIdAndUpdate(
        userId,
        {
          $addToSet: { 'forumActivity.likedThreads': threadId }
        },
        { new: true }
      );
    }

    // 4. Get updated like count
    const likeCount = updatedThread.likeCount;

    res.status(200).json({
      success: true,
      data: {
        thread: updatedThread,
        likeCount,
        isLiked: !alreadyLiked
      },
      message: alreadyLiked ? 'Thread unliked successfully' : 'Thread liked successfully'
    });

  } catch (error) {
    console.error('Error toggling thread like:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle thread like',
      error: error.message
    });
  }
};


/**
 * @desc    Get threads by tag
 * @route   GET /api/forum/threads/tags/:tag
 * @access  Public
 */
export const getThreadsByTags = async (req, res) => {
  try {
    const { tags } = req.params;
    
    if (!tags) {
      return res.status(400).json({ success: false, message: 'Tags parameter is required' });
    }

    const tagArray = Array.isArray(tags) ? tags : [tags];
    
    const threads = await ThreadModel.find({ 
      tags: { $in: tagArray } 
    })
    .populate('author', 'name username avatar')
    .select('-__v') // Exclude version key
    .sort({ createdAt: -1 })
    .lean();

    res.status(200).json({
      data: threads, 
      success: true, 
      message: 'Threads fetched successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching threads by tags', 
      error: error.message 
    });
  }
};

/**
 * @desc    Delete a forum thread
  */
export const deleteThread = async (req, res) => {
  try {
    const { threadId, userId } = req.params;

    //console.log('Deleting thread:', threadId, 'by user:', userId);return;

    if (!threadId || !userId) {
      return res.status(400).json({ success: false, message: 'Thread ID and User ID are required' });
    }
    // Find the thread
    const thread = await ThreadModel.findById(threadId);
    if (!thread) {
      return res.status(404).json({success: false, message: 'Thread not found' });
    }

    // Check if the user is the author or an admin
    if (!thread.author.equals(userId) && req.user.role !== 'admin') {
      return res.status(403).json({success: false, message: 'Not authorized to delete this thread' });
    }

    // Delete the thread and its comments (cascade delete is handled by middleware)
    await ThreadModel.deleteOne({ _id: threadId });

    // Remove the thread from the user's forumActivity.threads array
    await UserModel.updateOne(
      { _id: userId },
      { $pull: { 'forumActivity.threads': threadId } }
    );

    res.status(200).json({success: true, message: 'Thread deleted successfully' });
  } catch (error) {
    res.status(500).json({success: false, message: 'Error deleting thread', error: error.message });
  }
};