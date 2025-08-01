import cron from 'node-cron';
import axios from 'axios';
import { YoutubeVideoModel } from './../../youtube/models/youtube.model.js'; // Assuming this path is correct
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
    // new winston.transports.File({ filename: 'cron.log' }) // Uncomment to log to file
  ]
});

// Rate-limited YouTube API client
const youtubeApi = rateLimit(axios.create(), {
  maxRequests: 50,
  perMilliseconds: 1000
});

// Configuration
const config = {
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || 'AIzaSyCT-0XYYZf8UQ7NFZUQ-aF0AjzELuMQA2U', // from schooltraz@gmail.com
    apiUrl: 'https://www.googleapis.com/youtube/v3/search',
    videosUrl: 'https://www.googleapis.com/youtube/v3/videos',
    channelIds: ['UCkBV3nBa0iRdxEGc4DUS3xA', 'UCQJOYS9v30qM74f6gZDk0TA'], // Array of official channel IDs
    maxResults: 50,
  },
  // Prod
  cron: {
    trending: '0 */6 * * *',      // 12 AM, 6 AM, 12 PM, 6 PM (every 6 hours at :00)
    music: '30 0,12 * * *',       // 12:30 AM, 12:30 PM (every 12 hours at :30)
    videos: '15 */3 * * *',       // 12:15 AM, 3:15 AM, 6:15 AM, etc. (every 3 hours at :15)
    metrics: '45 */4 * * *'       // 12:45 AM, 4:45 AM, 8:45 AM, etc. (every 4 hours at :45)
  },
  // Dev (uncomment for development)
  // cron: {
  //   trending: '*/5 * * * *',
  //   music: '*/5 * * * *',
  //   videos: '*/5 * * * *',
  //   metrics: '*/5 * * * *'
  // },
  app: {
    maxRetries: 3,
    retryDelay: 5000,
    trendingPeriodDays: 30,
    batchSize: 5
  }
};

// Video data formatter with official content check
async function formatVideoData(item, videoDetails = {}) {
  if (!item?.id?.videoId || !item?.snippet) {
    throw new Error('Invalid video item format');
  }

  const isOfficial = config.youtube.channelIds.includes(item.snippet.channelId);

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

// Get video details with retry logic
async function getVideoDetails(videoId, retries = config.app.maxRetries) {
  try {
    const response = await youtubeApi.get(config.youtube.videosUrl, {
      params: {
        part: 'snippet,contentDetails,statistics',
        id: videoId,
        key: config.youtube.apiKey,
      }
    });

    return response.data.items[0] ? {
      duration: response.data.items[0].contentDetails?.duration,
      viewCount: parseInt(response.data.items[0].statistics?.viewCount || 0),
      likeCount: parseInt(response.data.items[0].statistics?.likeCount || 0),
      dislikeCount: parseInt(response.data.items[0].statistics?.dislikeCount || 0),
      commentCount: parseInt(response.data.items[0].statistics?.commentCount || 0),
      tags: response.data.items[0].snippet?.tags || []
    } : {};
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, config.app.retryDelay));
      return getVideoDetails(videoId, retries - 1);
    }
    logger.error(`Failed to fetch details for video ${videoId}: ${error.message}`);
    return {};
  }
}

// Save videos with classification
async function saveVideos(videos, menuType) {
  try {
    const bulkOps = [];

    for (const video of videos) {
      if (!video.youtubeVideoId) continue;

      const update = {
        $set: {
          ...video, // This includes views, likes, dislikes, commentCount, and other video details
          lastUpdatedFromYouTube: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        },
        $addToSet: {
          menuTypes: {
            $each: determineMenuTypes(video, menuType)
          }
        }
        // Removed the $push operation for 'updateHistory' to only store latest metrics
      };

      bulkOps.push({
        updateOne: {
          filter: { youtubeVideoId: video.youtubeVideoId },
          update,
          upsert: true
        }
      });
    }

    if (bulkOps.length === 0) {
      logger.warn(`No valid videos to save for ${menuType}`);
      return;
    }

    const result = await YoutubeVideoModel.bulkWrite(bulkOps);
    logger.info(`Saved ${result.upsertedCount} new and updated ${result.modifiedCount} existing videos for ${menuType}`);
    return result;
  } catch (error) {
    logger.error(`Database save error for ${menuType}: ${error.message}`);
    throw error;
  }
}

// Determine menu types
function determineMenuTypes(video, primaryMenuType) {
  const types = [primaryMenuType];

  if (primaryMenuType === 'music') {
    types.push('trending');
  } else if (primaryMenuType === 'trending' && !video.isOfficialContent) {
    types.push('videos');
  }

  return types;
}

// Process videos in batches
async function processVideosInBatches(items, processor, batchSize = config.app.batchSize) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    try {
      await processor(batch);
      // Introduce a small delay to respect API limits and database load
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      logger.error(`Error processing batch ${i}-${i + batchSize}: ${error.message}`);
    }
  }
}

// 1. Trending Videos Job
cron.schedule(config.cron.trending, async () => {
  logger.info('Starting Trending videos update...');

  try {
    const params = {
      part: 'snippet',
      q: 'Davido', // Or any other trending query
      type: 'video',
      maxResults: config.youtube.maxResults,
      order: 'viewCount',
      regionCode: 'NG', // Nigeria
      key: config.youtube.apiKey,
      publishedAfter: new Date(Date.now() - config.app.trendingPeriodDays * 24 * 60 * 60 * 1000).toISOString()
    };

    const { data } = await youtubeApi.get(config.youtube.apiUrl, { params });
    if (!data?.items?.length) {
      logger.warn('No trending videos found in API response');
      return;
    }

    await processVideosInBatches(data.items, async (batch) => {
      const videosWithDetails = await Promise.all(
        batch.map(async item => {
          try {
            const details = await getVideoDetails(item.id.videoId);
            return formatVideoData(item, details);
          } catch (error) {
            logger.error(`Error processing video ${item.id.videoId}: ${error.message}`);
            return null;
          }
        }).filter(v => v !== null) // Filter out any nulls from failed processing
      );

      await saveVideos(videosWithDetails, 'trending');
    });

    logger.info(`Trending update completed. Processed ${data.items.length} videos`);
  } catch (error) {
    logger.error(`Trending update failed: ${error.message}`);
  }
});

// 2. Music Videos Job (Official Content)
cron.schedule(config.cron.music, async () => {
  logger.info('Starting Music videos update for official channels...');

  try {
    for (const channelId of config.youtube.channelIds) {
      logger.info(`Processing official channel: ${channelId}`);

      const params = {
        part: 'snippet',
        channelId: channelId,
        type: 'video',
        maxResults: config.youtube.maxResults,
        order: 'date',
        key: config.youtube.apiKey
      };

      const { data } = await youtubeApi.get(config.youtube.apiUrl, { params });
      if (!data?.items?.length) {
        logger.warn(`No videos found for channel ${channelId}`);
        continue;
      }

      await processVideosInBatches(data.items, async (batch) => {
        const videosWithDetails = await Promise.all(
          batch.map(async item => {
            try {
              const details = await getVideoDetails(item.id.videoId);
              const videoData = await formatVideoData(item, details);
              // Force official content flag for channel-specific videos
              videoData.isOfficialContent = true;
              return videoData;
            } catch (error) {
              logger.error(`Error processing video ${item.id.videoId}: ${error.message}`);
              return null;
            }
          }).filter(v => v !== null)
        );

        await saveVideos(videosWithDetails, 'music');
      });

      logger.info(`Processed ${data.items.length} videos from channel ${channelId}`);
    }
  } catch (error) {
    logger.error(`Music update failed: ${error.message}`);
  }
});

// 3. General Videos Job
cron.schedule(config.cron.videos, async () => {
  logger.info('Starting General videos update...');

  try {
    const params = {
      part: 'snippet',
      q: 'Davido', // Or any broad general search query
      type: 'video',
      maxResults: config.youtube.maxResults,
      order: 'date',
      regionCode: 'NG',
      key: config.youtube.apiKey,
      publishedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    const { data } = await youtubeApi.get(config.youtube.apiUrl, { params });
    if (!data?.items?.length) {
      logger.warn('No general videos found in API response');
      return;
    }

    await processVideosInBatches(data.items, async (batch) => {
      const videosWithDetails = await Promise.all(
        batch.map(async item => {
          try {
            const details = await getVideoDetails(item.id.videoId);
            return formatVideoData(item, details);
          } catch (error) {
            logger.error(`Error processing video ${item.id.videoId}: ${error.message}`);
            return null;
          }
        }).filter(v => v !== null)
      );

      // Filter out official content to avoid duplication with 'music' category
      const generalVideos = videosWithDetails.filter(v =>
        v && !config.youtube.channelIds.includes(v.channelId)
      );

      await saveVideos(generalVideos, 'videos');
    });

    logger.info(`General videos update completed. Processed ${data.items.length} videos`);
  } catch (error) {
    logger.error(`General videos update failed: ${error.message}`);
  }
});

// 4. Metrics Update Job
cron.schedule(config.cron.metrics, async () => {
  logger.info('Starting Metrics update for existing videos...');

  try {
    // Find videos that haven't been updated from YouTube in the last 6 hours
    // Limiting to 100 to process in chunks
    const staleVideos = await YoutubeVideoModel.find({
      lastUpdatedFromYouTube: {
        $lt: new Date(Date.now() - 6 * 60 * 60 * 1000)
      }
    }).limit(100);

    if (staleVideos.length === 0) {
      logger.info('No stale videos found for metrics update');
      return;
    }

    await processVideosInBatches(staleVideos, async (batch) => {
      const updateOps = await Promise.all(
        batch.map(async video => {
          try {
            const details = await getVideoDetails(video.youtubeVideoId);
            return {
              updateOne: {
                filter: { _id: video._id },
                update: {
                  $set: {
                    // Overwrite with new metrics (if available, otherwise retain old)
                    views: details.viewCount || video.views,
                    likes: details.likeCount || video.likes,
                    dislikes: details.dislikeCount || video.dislikes,
                    commentCount: details.commentCount || video.commentCount,
                    lastUpdatedFromYouTube: new Date()
                  }
                  // Removed the $push operation for 'updateHistory'
                }
              }
            };
          } catch (error) {
            logger.error(`Failed to update metrics for video ${video.youtubeVideoId}: ${error.message}`);
            return null;
          }
        }).filter(op => op !== null) // Filter out any nulls from failed updates
      );

      if (updateOps.length > 0) {
        const result = await YoutubeVideoModel.bulkWrite(updateOps);
        logger.info(`Updated metrics for ${result.modifiedCount} videos in batch`);
      }
    });

    logger.info('Metrics update completed');
  } catch (error) {
    logger.error(`Metrics update job failed: ${error.message}`);
  }
});

logger.info('Cron jobs initialized', {
  schedules: Object.entries(config.cron).map(([name, schedule]) => ({ name, schedule }))
});