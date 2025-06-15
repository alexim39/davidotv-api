import cron from 'node-cron';
import axios from 'axios';
import { YoutubeVideoModel } from './../../youtube/models/youtube.model.js'
import rateLimit from 'axios-rate-limit';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'cron.log' })
  ]
});

// Rate-limited YouTube API client
const youtubeApi = rateLimit(axios.create(), { maxRequests: 100, perMilliseconds: 1000 });

// Configuration
const config = {
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || 'AIzaSyCnqQosiJ2hFLBMQM691p61f2mkkpg6Q7Y',
    apiUrl: 'https://www.googleapis.com/youtube/v3/search',
    videosUrl: 'https://www.googleapis.com/youtube/v3/videos',
    channelId: 'UCkBV3nBa0iRdxEGc4DUS3xA', // Davido's official channel
    maxResults: 50,
  },
  cron: {
    trending: '0 */6 * * *', // Every 6 hours
    music: '0 0 * * *', // Daily at midnight
    videos: '0 */3 * * *', // Every 3 hours
    metrics: '0 */2 * * *' // Every 2 hours for metrics update
  },
  app: {
    maxRetries: 3,
    retryDelay: 5000,
    trendingPeriodDays: 30 // Consider videos from last 30 days as trending
  }
};

// Enhanced video data formatter
async function formatVideoData(item, videoDetails = {}) {
  const isOfficial = item.snippet.channelId === config.youtube.channelId;
  
  return {
    youtubeVideoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    channel: item.snippet.channelTitle,
    channelId: item.snippet.channelId,
    publishedAt: new Date(item.snippet.publishedAt),
    thumbnail: {
      default: item.snippet.thumbnails?.default?.url || '',
      medium: item.snippet.thumbnails?.medium?.url || '',
      high: item.snippet.thumbnails?.high?.url || '',
      standard: item.snippet.thumbnails?.standard?.url || '',
      maxres: item.snippet.thumbnails?.maxres?.url || ''
    },
    duration: videoDetails.duration || '',
    views: videoDetails.viewCount || 0,
    likes: videoDetails.likeCount || 0,
    dislikes: videoDetails.dislikeCount || 0,
    commentCount: videoDetails.commentCount || 0,
    isOfficialContent: isOfficial,
    tags: item.snippet.tags || [],
    lastUpdatedFromYouTube: new Date()
  };
}

// Get complete video details
async function getVideoDetails(videoId) {
  try {
    const response = await youtubeApi.get(config.youtube.videosUrl, {
      params: {
        part: 'snippet,contentDetails,statistics',
        id: videoId,
        key: config.youtube.apiKey,
      }
    });
    
    const item = response.data.items[0];
    if (!item) return {};
    
    return {
      duration: item.contentDetails?.duration,
      viewCount: parseInt(item.statistics?.viewCount || 0),
      likeCount: parseInt(item.statistics?.likeCount || 0),
      dislikeCount: parseInt(item.statistics?.dislikeCount || 0),
      commentCount: parseInt(item.statistics?.commentCount || 0),
      tags: item.snippet?.tags || []
    };
  } catch (error) {
    logger.error(`Failed to fetch details for video ${videoId}: ${error.message}`);
    return {};
  }
}

// Save videos with proper classification
async function saveVideos(videos, menuType) {
  const bulkOps = videos.map(video => {
    const update = { 
      ...video,
      $addToSet: { menuTypes: menuType },
      lastUpdatedFromYouTube: new Date()
    };
    
    // For music section, ensure it's only official content
    if (menuType === 'music' && !video.isOfficialContent) {
      return null;
    }
    
    // For videos section, exclude official content if already in music
    if (menuType === 'videos' && video.isOfficialContent) {
      update.$addToSet = { menuTypes: { $each: ['videos', 'music'] } };
    }
    
    return {
      updateOne: {
        filter: { youtubeVideoId: video.youtubeVideoId },
        update: {
          $set: update,
          $setOnInsert: { createdAt: new Date() },
          $push: {
            updateHistory: {
              metrics: {
                views: video.views,
                likes: video.likes,
                dislikes: video.dislikes,
                commentCount: video.commentCount
              },
              updatedAt: new Date()
            }
          }
        },
        upsert: true
      }
    };
  }).filter(op => op !== null);

  if (bulkOps.length === 0) {
    logger.info(`No valid videos to save for ${menuType}`);
    return;
  }

  try {
    const result = await YoutubeVideoModel.bulkWrite(bulkOps);
    logger.info(`Saved ${result.upsertedCount} new and updated ${result.modifiedCount} existing videos for ${menuType}`);
    return result;
  } catch (error) {
    logger.error(`Database save error for ${menuType}: ${error.message}`);
    throw error;
  }
}

// 1. Trending Videos Job
cron.schedule(config.cron.trending, async () => {
  logger.info('Starting Trending videos update...');
  
  try {
    const params = {
      part: 'snippet',
      q: 'Davido',
      type: 'video',
      maxResults: config.youtube.maxResults,
      order: 'viewCount',
      regionCode: 'NG',
      key: config.youtube.apiKey,
      publishedAfter: new Date(Date.now() - config.app.trendingPeriodDays * 24 * 60 * 60 * 1000).toISOString()
    };

    const searchData = await youtubeApi.get(config.youtube.apiUrl, { params });
    if (!searchData?.data?.items) {
      logger.warn('No trending videos found');
      return;
    }

    const videosWithDetails = await Promise.all(
      searchData.data.items.map(async item => {
        const details = await getVideoDetails(item.id.videoId);
        return formatVideoData(item, details);
      })
    );

    await saveVideos(videosWithDetails, 'trending');
    logger.info('Trending videos update completed successfully');
  } catch (error) {
    logger.error(`Trending videos update failed: ${error.message}`);
  }
});

// 2. Music Videos Job (Official Content Only)
cron.schedule(config.cron.music, async () => {
  logger.info('Starting Music videos update...');
  
  try {
    const params = {
      part: 'snippet',
      channelId: config.youtube.channelId,
      type: 'video',
      maxResults: config.youtube.maxResults,
      order: 'date',
      key: config.youtube.apiKey,
    };

    const searchData = await youtubeApi.get(config.youtube.apiUrl, { params });
    if (!searchData?.data?.items) {
      logger.warn('No music videos found');
      return;
    }

    const videosWithDetails = await Promise.all(
      searchData.data.items.map(async item => {
        const details = await getVideoDetails(item.id.videoId);
        return formatVideoData(item, details);
      })
    );

    await saveVideos(videosWithDetails, 'music');
    logger.info('Music videos update completed successfully');
  } catch (error) {
    logger.error(`Music videos update failed: ${error.message}`);
  }
});

// 3. General Videos Job (Excluding Official Music)
cron.schedule(config.cron.videos, async () => {
  logger.info('Starting General videos update...');
  
  try {
    const params = {
      part: 'snippet',
      q: 'Davido',
      type: 'video',
      maxResults: config.youtube.maxResults,
      order: 'date',
      regionCode: 'NG',
      key: config.youtube.apiKey,
    };

    const searchData = await youtubeApi.get(config.youtube.apiUrl, { params });
    if (!searchData?.data?.items) {
      logger.warn('No general videos found');
      return;
    }

    const videosWithDetails = await Promise.all(
      searchData.data.items.map(async item => {
        const details = await getVideoDetails(item.id.videoId);
        return formatVideoData(item, details);
      })
    );

    // Filter out official content from general videos
    const generalVideos = videosWithDetails.filter(v => !v.isOfficialContent);
    await saveVideos(generalVideos, 'videos');
    logger.info('General videos update completed successfully');
  } catch (error) {
    logger.error(`General videos update failed: ${error.message}`);
  }
});

// 4. Metrics Update Job (Updates engagement metrics for existing videos)
cron.schedule(config.cron.metrics, async () => {
  logger.info('Starting Metrics update for existing videos...');
  
  try {
    // Get videos that haven't been updated in the last 6 hours
    const staleVideos = await YoutubeVideoModel.find({
      lastUpdatedFromYouTube: { 
        $lt: new Date(Date.now() - 6 * 60 * 60 * 1000) 
      }
    }).limit(100); // Process 100 at a time to avoid rate limiting

    if (staleVideos.length === 0) {
      logger.info('No stale videos found for metrics update');
      return;
    }

    const updateOps = await Promise.all(
      staleVideos.map(async video => {
        try {
          const details = await getVideoDetails(video.youtubeVideoId);
          
          return {
            updateOne: {
              filter: { _id: video._id },
              update: {
                $set: {
                  views: details.viewCount || video.views,
                  likes: details.likeCount || video.likes,
                  dislikes: details.dislikeCount || video.dislikes,
                  commentCount: details.commentCount || video.commentCount,
                  lastUpdatedFromYouTube: new Date()
                },
                $push: {
                  updateHistory: {
                    metrics: {
                      views: details.viewCount || video.views,
                      likes: details.likeCount || video.likes,
                      dislikes: details.dislikeCount || video.dislikes,
                      commentCount: details.commentCount || video.commentCount
                    },
                    updatedAt: new Date()
                  }
                }
              }
            }
          };
        } catch (error) {
          logger.error(`Failed to update metrics for video ${video.youtubeVideoId}: ${error.message}`);
          return null;
        }
      })
    );

    const validOps = updateOps.filter(op => op !== null);
    if (validOps.length > 0) {
      const result = await YoutubeVideoModel.bulkWrite(validOps);
      logger.info(`Updated metrics for ${result.modifiedCount} videos`);
    }
  } catch (error) {
    logger.error(`Metrics update job failed: ${error.message}`);
  }
});

logger.info('All cron jobs initialized and running', {
  jobs: Object.keys(config.cron).map(job => ({
    name: job,
    schedule: config.cron[job]
  }))
});