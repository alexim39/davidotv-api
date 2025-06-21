import express from 'express';
import {saveVideoToLibrary, getSavedVideos, removeVideoFromLibrary} from '../controllers/user.controller.js'

const UserRouter = express.Router();

UserRouter.post('/library/save', saveVideoToLibrary);
UserRouter.get('/library/:userId', getSavedVideos);
UserRouter.delete('/library/remove/:userId/:youtubeVideoId', removeVideoFromLibrary);


export default UserRouter;