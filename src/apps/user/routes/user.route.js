import express from 'express';
import {
    saveVideoToLibrary, 
    getSavedVideos, 
    removeVideoFromLibrary, 
    getWatchHistory, 
    updateWatchHistory, 
    removeFromWatchedHistory,
    clearWatchHistory,
    updatePersonalInfo,
    updateProfessioinalInfo,
    updateUsername,
    updateTestimonial,
    getAllTestimonials
} from '../controllers/user.controller.js'

const UserRouter = express.Router();

UserRouter.put('/testimonial', updateTestimonial);
UserRouter.get('/testimonials', getAllTestimonials);
UserRouter.post('/library/save', saveVideoToLibrary);
UserRouter.put('/profile/personal', updatePersonalInfo);
UserRouter.put('/profile/profession', updateProfessioinalInfo);
UserRouter.put('/profile/username', updateUsername);
//UserRouter.put('/profile/password', updatePersonalInfo);
UserRouter.get('/library/:userId', getSavedVideos);
UserRouter.delete('/library/remove/:userId/:youtubeVideoId', removeVideoFromLibrary);


UserRouter.get('/history/video/:userId', getWatchHistory);
UserRouter.post('/history/save', updateWatchHistory);
UserRouter.delete('/history/remove/:watchedVideoId/:userId', removeFromWatchedHistory);
UserRouter.delete('/history/clear/:userId', clearWatchHistory);

export default UserRouter;