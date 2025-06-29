import { UserModel } from './../../user/models/user.model.js';
import { ThreadModel } from './../models/forum.model.js';
import { CommentModel } from '../models/forum.model.js';
import mongoose from 'mongoose';


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

    // Get comments with authors populated
    const comments = await CommentModel.find({ thread: threadId, parentComment: null })
      .populate('author', 'name username avatar')
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
 * @desc    Get all comments for a thread
 * @route   GET /api/forum/threads/:threadId/comments
 * @access  Public
 */
export const getThreadComments = async (req, res) => {
    try {
        const { threadId } = req.params;

        // 1. Validate the thread exists
        const thread = await ThreadModel.findById(threadId);
        if (!thread) {
            return res.status(404).json({
                success: false,
                message: 'Thread not found'
            });
        }

        // 2. Fetch comments with user details and reply count
        const comments = await CommentModel.aggregate([
            // Match only comments for this thread and not deleted
            { $match: { 
                thread: new mongoose.Types.ObjectId(threadId),
                isDeleted: false 
            }},
            
            // Lookup to get author details
            { $lookup: {
                from: 'users',
                localField: 'author',
                foreignField: '_id',
                as: 'author',
                pipeline: [
                    { $project: { 
                        name: 1,
                        username: 1,
                        avatar: 1
                    }}
                ]
            }},
            
            // Unwind the author array (since lookup returns an array)
            { $unwind: '$author' },
            
            // Lookup to count replies
            { $lookup: {
                from: 'comments',
                localField: '_id',
                foreignField: 'parentComment',
                as: 'replies'
            }},
            
            // Add fields for reply count and like count
           /*  { $addFields: {
                replyCount: { $size: '$replies' },
                likeCount: { $size: '$likedBy' },
                // Check if current user liked this comment
                isLiked: req.user ? { 
                    $in: [new mongoose.Types.ObjectId(req.user.id), '$likedBy'] 
                } : false
            }}, */
            { $addFields: {
                replyCount: { $size: { $ifNull: ['$replies', []] } },
                likeCount: { $size: { $ifNull: ['$likedBy', []] } },
                isLiked: req.user ? { 
                    $in: [new mongoose.Types.ObjectId(req.user.id), { $ifNull: ['$likedBy', []] }] 
                } : false
            }},
            
            // Project only the fields we need
            { $project: {
                content: 1,
                createdAt: 1,
                updatedAt: 1,
                'author._id': 1,
                'author.name': 1,
                'author.username': 1,
                'author.avatar': 1,
                likeCount: 1,
                replyCount: 1,
                isLiked: 1
            }},
            
            // Sort by newest first
            { $sort: { createdAt: -1 } }
        ]);

        // 3. Return the formatted response
        res.status(200).json({
            success: true,
            count: comments.length,
            data: comments
        });

    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching comments',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};




/**
 * @desc    Add a comment to a thread
 * @route   POST /api/forum/threads/:threadId/comments
 * @access  Private
 */
export const addCommentToThread = async (req, res) => {
  try {
    const {threadId, content, parentCommentId, authorId } = req.body;

    // 1. Validate the thread exists and is not locked
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

    // 2. Validate parent comment if this is a reply
    if (parentCommentId) {
      const parentComment = await CommentModel.findById(parentCommentId);
      if (!parentComment || parentComment.thread.toString() !== threadId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid parent comment'
        });
      }
    }

    // 3. Create the new comment
    const newComment = new CommentModel({
      content,
      author: authorId,
      thread: threadId,
      parentComment: parentCommentId || null
    });

    // 4. Save the comment
    const savedComment = await newComment.save();

    // 5. Update thread's comment count (unless it's a reply)
    if (!parentCommentId) {
      await ThreadModel.findByIdAndUpdate(threadId, {
        $inc: { commentCount: 1 }
      });
    }

    // 6. Update user's forum activity
    await UserModel.findByIdAndUpdate(authorId, {
      $push: { 'forumActivity.comments': savedComment._id }
    });

    // 7. Populate author info before sending response
    const populatedComment = await CommentModel.findById(savedComment._id)
      .populate('author', 'name username avatar');

    res.status(201).json({
      success: true,
      data: populatedComment,
      message: parentCommentId ? 'Reply added successfully' : 'Comment added successfully'
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