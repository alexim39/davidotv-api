import express from 'express';
import {
    saveVideoToLibrary, 
    getSavedVideos, 
    removeVideoFromLibrary, 
    getWatchHistory, 
    updateWatchHistory, 
    removeFromWatchedHistory,
    clearWatchHistory
} from '../controllers/user.controller.js'

const UserRouter = express.Router();

UserRouter.post('/library/save', saveVideoToLibrary);
UserRouter.get('/library/:userId', getSavedVideos);
UserRouter.delete('/library/remove/:userId/:youtubeVideoId', removeVideoFromLibrary);

UserRouter.get('/history/video/:userId', getWatchHistory);
UserRouter.post('/history/save', updateWatchHistory);
UserRouter.delete('/history/remove/:watchedVideoId/:userId', removeFromWatchedHistory);
UserRouter.delete('/history/clear/:userId', clearWatchHistory);

export default UserRouter;