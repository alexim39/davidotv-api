import express from 'express';
const app = express();
app.use(express.json()); // Use json middleware
app.use(express.urlencoded({extended: false})); // Use formdata middleware
import ForumRouter from './routes/forum.route.js';
export default ForumRouter;