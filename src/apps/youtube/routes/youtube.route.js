import express from 'express';
import {getVideos, getVideoById, searchVideos, getPlaylistVideos, likeVideo, dislikeVideo } from '../controllers/youtube.controller.js'
import { addComment, addReply, likeComment, likeCommentReply, deleteComment, deleteCommentReply } from '../controllers/conmment.controller.js'
import { fetchAndStoreVideoById } from './../services/fetchAndStoreVideoById.js';

const YoutubeRouter = express.Router();
YoutubeRouter.get('/videos', getVideos);
YoutubeRouter.get('/videos/playlist', getPlaylistVideos);
YoutubeRouter.get('/videos/search', searchVideos);


YoutubeRouter.post('/videos/like', likeVideo);
YoutubeRouter.post('/videos/dislike', dislikeVideo);

// comment section
YoutubeRouter.patch('/comment/add', addComment);
YoutubeRouter.patch('/comment/reply/add', addReply);
YoutubeRouter.get('/videos/:videoId', getVideoById);

YoutubeRouter.patch('/comment/like/:commentId/:videoId', likeComment);
YoutubeRouter.post('/comments/reply/like', likeCommentReply);
YoutubeRouter.delete('/comment/delete/:commentId/:userId/:videoId', deleteComment);
YoutubeRouter.delete('/comment/reply/delete/:parentCommentId/:replyId/:userId/:videoId', deleteCommentReply);






YoutubeRouter.post('/fetchAndStoreVideoById/:videoId',  async (req, res) => {
  try {
    const video = await fetchAndStoreVideoById(req.params.videoId, req.body.menuType || 'music');
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default YoutubeRouter;