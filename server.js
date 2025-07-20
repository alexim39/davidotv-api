import express from 'express';
import mongoose from 'mongoose';
import dotenv  from "dotenv"
import cors from 'cors';
import cookieParser from 'cookie-parser';
import './src/apps/youtube/services/crawler.js'; // Youtube crawler
import './src/apps/youtube/services/crawler2.js'; // Youtube crawler2

import AuthRouter from './src/apps/auth/index.js';
import YoutubeRouter from './src/apps/youtube/index.js';
import EmailSubscriptionRouter from './src/apps/email-subscription/index.js';
import UserRouter from './src/apps/user/index.js';
import ForumRouter from './src/apps/forum/index.js';
import EventRouter from './src/apps/event/index.js';
import ContactRouter from './src/apps/contact/index.js';
import PlaylistRouter from './src/apps/playlist/index.js';
import SettingsRouter from './src/apps/settings/index.js';


const port = process.env.PORT || 3000;
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware
dotenv.config()
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: [
        'http://localhost:4200', 
        'https://davidotv.com', 
        'http://davidotv.com',
        'www.davidotv.com',
    ]
}));

/* Routes */
app.get('/', (req, res) => res.send('Node server is up and running'));
app.use('/auth', AuthRouter);
app.use('/email', EmailSubscriptionRouter);
app.use('/youtube', YoutubeRouter);
app.use('/user', UserRouter);
app.use('/forum', ForumRouter);
app.use('/event', EventRouter);
app.use('/contact', ContactRouter);
app.use('/playlist', PlaylistRouter);
app.use('/settings', SettingsRouter);


/* DB connection */
mongoose.connect(`mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.ltu282p.mongodb.net/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority`)
.then(() => {
    // Application Starts Only when MongoDB is connected
    console.log('Connected to mongoDB')
    app.listen(port, () => {
        console.log(`Server is running on port: http://localhost:${port}`)
    })
}).catch((error) => {
    console.error('Error from mongoDB connection ', error)
})