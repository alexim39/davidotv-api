import { UserModel } from './../../user/models/user.model.js';
import { ThreadModel } from './../models/forum.model.js';
import { CommentModel } from '../models/forum.model.js';

/**
 *  @desc    Create a new forum thread
 */
export const createThread = async (req, res) => {
  try {

    // Create new thread
    const newThread = new ThreadModel({
      title: req.body.title,
      content: req.body.content,
      author: req.body.authorId,
      tags: req.body.tags || []
    });

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
 * @desc    Add a top-level comment to a thread
 * @route   POST /api/forum/threads/:threadId/comments
 * @access  Private
 */
export const addCommentToThread = async (req, res) => {
  try {
    // const { threadId } = req.params;
    // const { content } = req.body;
    // const authorId = req.user.id;
    const {threadId, content, authorId } = req.body;

    // Validate thread exists and isn't locked
    const thread = await ThreadModel.findById(threadId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    if (thread.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot comment on a locked thread'
      });
    }

    // Create and save comment
    const newComment = new CommentModel({
      content,
      author: authorId,
      thread: threadId,
      parentComment: null // Explicitly null for top-level
    });

    const savedComment = await newComment.save();

    // Update thread's comment count
    await ThreadModel.findByIdAndUpdate(threadId, {
      $inc: { commentCount: 1 },
      $set: { updatedAt: new Date() }
    });

    // Update user's forum activity
    await UserModel.findByIdAndUpdate(authorId, {
      $push: { 'forumActivity.comments': savedComment._id }
    });

    // Populate and return response
    const populatedComment = await CommentModel.findById(savedComment._id)
      .populate('author', 'name username avatar')
      .lean();

    res.status(201).json({
      success: true,
      data: {
        ...populatedComment,
        replyCount: 0,
        likeCount: 0,
        isLiked: false
      },
      message: 'Comment added successfully'
    });

  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
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

    console.log('Toggling like for thread:', threadId, 'by user:', userId);

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
      );

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
      );

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
        threadId,
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
 * @desc    Add a reply to a comment
 * @route   POST /api/forum/comments/:commentId/replies
 * @access  Private
 */
// In your backend controller
export const addCommentReply = async (req, res) => {
  try {
    const { content, authorId, commentId } = req.body; // Remove threadId from body

    // 1. Get parent comment and thread ID
    const parentComment = await CommentModel.findById(commentId);
    if (!parentComment) {
      return res.status(404).json({ success: false, message: 'Parent comment not found' });
    }

    const threadId = parentComment.thread;

    // 2. Create reply with proper parent reference
    const newReply = new CommentModel({
      content,
      author: authorId,
      thread: threadId,
      parentComment: commentId,
      isReply: true // Mark as reply
    });

    const savedReply = await newReply.save();

    // 3. Update parent comment's replies array
    await CommentModel.findByIdAndUpdate(commentId, {
      $push: { replies: savedReply._id },
      $inc: { replyCount: 1 }
    });

    // 4. Return populated reply
    const populatedReply = await CommentModel.findById(savedReply._id)
      .populate('author', 'name username avatar')
      .lean();

    res.status(201).json({
      success: true,
      data: {
        ...populatedReply,
        isReply: true, // Ensure this is set
        replyCount: 0,
        likeCount: 0,
        isLiked: false
      }
    });

  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ success: false, message: 'Failed to add reply' });
  }
};

