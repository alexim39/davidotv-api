import express from 'express';
import {
    createThread, 
    getThreads, 
    getThreadById, 
    getThreadComments, 
    addCommentToThread
} from '../controllers/forum.controller.js'
const ForumRouter = express.Router();

// add new thread
ForumRouter.post('/threads/new', createThread);
// get a thread by ID
ForumRouter.get('/thread/:id', getThreadById);
// get all threads
ForumRouter.get('/threads', getThreads);
// get comments for a specific thread
ForumRouter.get('/thread/comments/:threadId', getThreadComments);
// add a new comment to a thread
ForumRouter.post('/thread/comment/new', addCommentToThread);
export default ForumRouter;