import { YoutubeVideoModel } from '../models/youtube.model.js';
import mongoose from 'mongoose';
import { UserModel } from '../../user/models/user.model.js';

// Add comments to youtube videos
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

// Add reply to a comment on a youtube video
export const addReply = async (req, res) => {
    try {
        const { userId, videoId, parentCommentId, text } = req.body;

        // Validate required fields
        if (!userId || !videoId || !parentCommentId || !text) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: userId, videoId, parentCommentId, or text'
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

        // Find the user
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find the parent comment
        const parentComment = video.comments.id(parentCommentId);
        if (!parentComment) {
            return res.status(404).json({
                success: false,
                message: 'Parent comment not found'
            });
        }

        // Create the new reply subdocument
        const newReply = {
            userId,
            text,
            likes: 0,
            likedBy: [],
            parentComment: parentCommentId, // This correctly links it to the parent
            isEdited: false,
            isPinned: false,
        };

        // Add the reply subdocument to the video's comments array
        // This is where the correction is. We push the newReply object directly.
        // Mongoose will assign an _id to it when saved.
        video.comments.push(newReply);
        const addedReply = video.comments[video.comments.length - 1]; // Get the newly added reply with its _id

        // Add the reply reference (its _id) to the parent comment's replies array
        parentComment.replies.push(addedReply._id); // Use the _id assigned by Mongoose

        // Update comment count (this will now count both top-level comments and replies)
        // If you only want top-level comments to count for commentCount, you'll need
        // to adjust this logic. For now, it counts all entries in the `comments` array.
        video.commentCount = video.comments.length;

        // Save the video with the new reply
        await video.save();

        res.status(201).json({
            success: true,
            message: 'Reply added successfully',
            reply: {
                _id: addedReply._id, // Use the _id from the saved reply
                userId: addedReply.userId,
                text: addedReply.text,
                createdAt: addedReply.createdAt,
                parentCommentId: addedReply.parentComment
            },
            videoId: video.youtubeVideoId,
            parentCommentId: parentCommentId
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};


// Like a comment on a video
export const likeComment = async (req, res) => {
    try {
        const { videoId, commentId } = req.params;
        const { userId } = req.body;

        // Validate required fields
        if (!userId || !videoId || !commentId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: userId, videoId, or commentId'
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

        // Find the comment
        const comment = video.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Check if user already liked the comment
        const alreadyLiked = comment.likedBy.some(id => id.equals(userId));
        if (alreadyLiked) {
            return res.status(400).json({
                success: false,
                message: 'You already gave this a like'
            });
        }

        // Update comment likes
        comment.likes += 1;
        comment.likedBy.push(userId);

        // Update comment stats
        video.commentStats.totalLikes += 1;

        await video.save();

        res.status(200).json({
            success: true,
            message: 'Your like has been added',
            likes: comment.likes,
            commentId: comment._id,
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



// Like a reply to a comment
export const likeCommentReply = async (req, res) => {
    try {
        const { userId, videoId, replyId } = req.body;

        // Validate required fields
        if (!userId || !videoId || !replyId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: userId, videoId, or replyId'
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

        // Find the reply (which is also a comment with parentComment field)
        const reply = video.comments.id(replyId);
        if (!reply || !reply.parentComment) {
            return res.status(404).json({
                success: false,
                message: 'Reply not found or not a valid reply'
            });
        }

        // Check if user already liked the reply
        const alreadyLiked = reply.likedBy.some(id => id.equals(userId));
        if (alreadyLiked) {
            return res.status(400).json({
                success: false,
                message: 'User already liked this reply'
            });
        }

        // Update reply likes
        reply.likes += 1;
        reply.likedBy.push(userId);

        // Update comment stats
        video.commentStats.totalLikes += 1;

        await video.save();

        res.status(200).json({
            success: true,
            message: 'Reply liked successfully',
            likes: reply.likes,
            replyId: reply._id,
            parentCommentId: reply.parentComment,
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


/**
 * @desc    Deletes a main comment from a YouTube video.
 * This also handles the deletion of all replies associated with the main comment.
 * @route   DELETE /api/videos/:videoId/comments/:commentId
 * @access  Private (assuming user authentication is handled by middleware)
 */
export const deleteComment = async (req, res) => {
    try {
        const { videoId, commentId, userId } = req.params;
        // In a real application, you would also check if req.user.id matches the comment's userId
        // or if the user has admin privileges.

        const video = await YoutubeVideoModel.findById(videoId);

        if (!video) {
            return res.status(404).json({ success: false, message: 'Video not found.' });
        }

        const commentToDelete = video.comments.id(commentId);

        if (!commentToDelete) {
            return res.status(404).json({ success: false, message: 'Comment not found.' });
        }

        // Authorization check: Ensure the user is either the comment owner or an admin
        if ((!commentToDelete.userId.equals(userId) && req.user.role !== 'admin')) {
        //if (!req.user || (!commentToDelete.userId.equals(userId) && req.user.role !== 'admin')) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this comment.' });
        }

        // Collect all IDs to remove: the comment itself and all its direct and indirect replies.
        // This is necessary because replies are also stored as separate documents in the flat 'comments' array.
        const idsToRemove = [commentToDelete._id];
        let repliesToProcess = [...commentToDelete.replies]; // Start with direct replies

        while (repliesToProcess.length > 0) {
            const currentReplyId = repliesToProcess.shift();
            const currentReply = video.comments.id(currentReplyId);
            if (currentReply) {
                idsToRemove.push(currentReply._id);
                // If this reply also has replies, add them to the queue
                if (currentReply.replies && currentReply.replies.length > 0) {
                    repliesToProcess.push(...currentReply.replies);
                }
            }
        }

        // Filter out all comments whose IDs are in the idsToRemove array
        video.comments = video.comments.filter(c => !idsToRemove.some(id => id.equals(c._id)));

        // Mongoose's pre('save') hook for commentStats will automatically re-calculate
        // totalComments, totalLikes, and topComments after this save operation.
        await video.save();

        res.status(200).json({ success: true, message: 'Comment and its replies deleted successfully.', commentId });

    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
};



/**
 * @desc    Deletes a specific comment reply from a YouTube video.
 * @route   DELETE /api/videos/:videoId/comments/:parentCommentId/replies/:replyId
 * @access  Private (assuming user authentication is handled by middleware)
 */
export const deleteCommentReply = async (req, res) => {
    try {
        const { videoId, parentCommentId, replyId, userId } = req.params;
        // In a real application, you would also check if req.user.id matches the reply's userId
        // or if the user has admin privileges.

        const video = await YoutubeVideoModel.findById(videoId);

        if (!video) {
            return res.status(404).json({ success: false, message: 'Video not found.' });
        }

        const parentComment = video.comments.id(parentCommentId);
        if (!parentComment) {
            return res.status(404).json({ success: false, message: 'Parent comment not found.' });
        }

        const replyToDelete = video.comments.id(replyId);
        if (!replyToDelete) {
            return res.status(404).json({ success: false, message: 'Reply not found.' });
        }

        // Verify that the reply actually belongs to the specified parent comment
        if (!replyToDelete.parentComment || !replyToDelete.parentComment.equals(parentCommentId)) {
            return res.status(400).json({ success: false, message: 'Invalid reply or parent comment association.' });
        }

        // Authorization check: Ensure the user is either the reply owner or an admin
        if ( (!replyToDelete.userId.equals(userId) && req.user.role !== 'admin')) {
        //if (!req.user || (!replyToDelete.userId.equals(req.user.id) && req.user.role !== 'admin')) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this reply.' });
        }

        // Remove the reply's ID from the parent comment's replies array
        parentComment.replies = parentComment.replies.filter(rId => !rId.equals(replyId));

        // Remove the reply document itself from the main comments array
        video.comments = video.comments.filter(c => !c._id.equals(replyId));

        // Mongoose's pre('save') hook for commentStats will automatically re-calculate
        // totalComments, totalLikes, and topComments after this save operation.
        await video.save();

        res.status(200).json({ success: true, message: 'Comment reply deleted successfully.', replyId });

    } catch (error) {
        console.error('Error deleting comment reply:', error);
        res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
};