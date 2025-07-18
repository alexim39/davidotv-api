import express from 'express';
import { 
    toggleNotification, toggleTheme, getThemeSetting
} from '../controllers/settings.controller.js'

const SettingsRouter = express.Router();

// toggle notification settings
SettingsRouter.post('/notification', toggleNotification);

// toggle theme settings
SettingsRouter.post('/theme', toggleTheme);

// Get partner theme setting
SettingsRouter.get('/theme/:partnerId', getThemeSetting);

export default SettingsRouter;