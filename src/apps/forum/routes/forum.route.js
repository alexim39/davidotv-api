import express from 'express';
import {
    createThread, 
    getThreads, 
    getThreadById, 
    addCommentToThread,
    toggleThreadLike,
    addCommentReply,
} from '../controllers/forum.controller.js'
const ForumRouter = express.Router();

// add new thread
ForumRouter.post('/threads/new', createThread);
// get a thread by ID
ForumRouter.get('/thread/:id', getThreadById);
// get all threads
ForumRouter.get('/threads', getThreads);
// get comments for a specific thread
// add a new comment to a thread
ForumRouter.post('/thread/comment/new', addCommentToThread);
// add comment reply in a thread
ForumRouter.post('/thread/comment/reply', addCommentReply);
// like/dislike a thread
ForumRouter.put('/thread/like', toggleThreadLike);
export default ForumRouter;