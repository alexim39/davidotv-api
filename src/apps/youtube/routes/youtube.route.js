import express from 'express';
import {getVideos, getVideoById, searchVideos, getPlaylistVideos } from '../controllers/youtube.controller.js'

const YoutubeRouter = express.Router();


//YoutubeRouter.get('/trending', {});
//YoutubeRouter.put('/videos', updateVideoMetrics);
YoutubeRouter.get('/videos', getVideos);
YoutubeRouter.get('/videos/playlist', getPlaylistVideos);
YoutubeRouter.get('/videos/search', searchVideos);
YoutubeRouter.get('/videos/:videoId', getVideoById);

export default YoutubeRouter;