import express from 'express';
import {getVideos, getVideoById, searchVideos, getPlaylistVideos, addComment, likeVideo, dislikeVideo } from '../controllers/youtube.controller.js'
import { fetchAndStoreVideoById } from './../services/fetchAndStoreVideoById.js';

const YoutubeRouter = express.Router();
YoutubeRouter.get('/videos', getVideos);
YoutubeRouter.get('/videos/playlist', getPlaylistVideos);
YoutubeRouter.get('/videos/search', searchVideos);
YoutubeRouter.get('/videos/:videoId', getVideoById);
YoutubeRouter.patch('/comment/add', addComment);
YoutubeRouter.post('/videos/like', likeVideo);
YoutubeRouter.post('/videos/dislike', dislikeVideo);






YoutubeRouter.post('/fetchAndStoreVideoById/:videoId',  async (req, res) => {
  try {
    const video = await fetchAndStoreVideoById(req.params.videoId, req.body.menuType || 'music');
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default YoutubeRouter;