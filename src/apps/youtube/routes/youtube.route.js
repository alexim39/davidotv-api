import express from 'express';
import {addVideos, getAllVideos } from '../controllers/youtube.controller.js'

const YoutubeRouter = express.Router();


//YoutubeRouter.get('/trending', {});
YoutubeRouter.post('/videos', addVideos);
YoutubeRouter.get('/videos', getAllVideos);

export default YoutubeRouter;