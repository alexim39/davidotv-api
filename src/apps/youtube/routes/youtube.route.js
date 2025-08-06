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







import { YoutubeVideoModel } from '../models/youtube.model.js';
YoutubeRouter.post('/fetchAndStoreVideoById/:videoId',  async (req, res) => {
  try {
    const video = await fetchAndStoreVideoById(req.params.videoId, req.body.menuType || 'music');
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

YoutubeRouter.get('/updateVideoDurations',  async (req, res) => {
  try {
    const videos = await YoutubeVideoModel.find({ duration: { $exists: true } });

    const bulkOps = [];

    for (const video of videos) {
      const matches = video.duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
      if (!matches) continue;

      const minutes = parseInt(matches[1] || '0', 10);
      const seconds = parseInt(matches[2] || '0', 10);
      const totalSeconds = (minutes * 60) + seconds;

      const needsUpdate =
        video.durationSeconds !== totalSeconds || typeof video.isShort === 'undefined';

      if (needsUpdate) {
        bulkOps.push({
          updateOne: {
            filter: { _id: video._id },
            update: {
              $set: {
                durationSeconds: totalSeconds,
                isShort: totalSeconds <= 60,
              },
            },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      await YoutubeVideoModel.bulkWrite(bulkOps);
    }

    console.log(`✅ Updated ${bulkOps.length} video records`);
    return res.status(200).json({ message: `Updated ${bulkOps.length} videos.` });
  } catch (error) {
    console.error('❌ Error updating video durations:', error);
    return res.status(500).json({ error: 'Something went wrong.' });
  } finally {
    //await mongoose.disconnect();
  }
})

export default YoutubeRouter;