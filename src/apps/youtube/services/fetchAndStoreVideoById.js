import axios from 'axios';
import { YoutubeVideoModel } from '../models/youtube.model.js';
import winston from 'winston';

// Configure logger (same as in your cron job)
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'youtube-controller.log' })
  ]
});

// Rate-limited YouTube API client
const youtubeApi = axios.create({
  baseURL: 'https://www.googleapis.com/youtube/v3',
  params: {
    key: process.env.YOUTUBE_API_KEY || 'AIzaSyCnqQosiJ2hFLBMQM691p61f2mkkpg6Q7Y'
  }
});

// Configuration
const config = {
  youtube: {
    channelId: 'UCkBV3nBa0iRdxEGc4DUS3xA' // Your official channel ID
  },
  app: {
    maxRetries: 3,
    retryDelay: 5000
  }
};

/**
 * Fetches video details from YouTube API
 * @param {string} videoId YouTube video ID
 * @param {number} retries Number of retry attempts remaining
 * @returns {Promise<Object>} Video details
 */
async function getVideoDetails(videoId, retries = config.app.maxRetries) {
  try {
    const response = await youtubeApi.get('/videos', {
      params: {
        part: 'snippet,contentDetails,statistics',
        id: videoId
      }
    });
    
    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    const item = response.data.items[0];
    return {
      duration: item.contentDetails?.duration,
      viewCount: parseInt(item.statistics?.viewCount || 0),
      likeCount: parseInt(item.statistics?.likeCount || 0),
      dislikeCount: parseInt(item.statistics?.dislikeCount || 0),
      commentCount: parseInt(item.statistics?.commentCount || 0),
      tags: item.snippet?.tags || []
    };
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, config.app.retryDelay));
      return getVideoDetails(videoId, retries - 1);
    }
    logger.error(`Failed to fetch details for video ${videoId}: ${error.message}`);
    throw error;
  }
}

/**
 * Formats video data for database storage
 * @param {Object} item YouTube API video item
 * @param {Object} videoDetails Additional video details
 * @returns {Object} Formatted video data
 */
function formatVideoData(item, videoDetails = {}) {
  const isOfficial = item.snippet.channelId === config.youtube.channelId;
  
  return {
    youtubeVideoId: item.id,
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
    //isOfficialContent: isOfficial,
    isOfficialContent: true,
    tags: videoDetails.tags || [],
    lastUpdatedFromYouTube: new Date()
  };
}

/**
 * Saves video to database with proper classification
 * @param {Object} videoData Formatted video data
 * @param {string} menuType Primary menu type ('trending', 'music', 'videos')
 * @returns {Promise<Object>} Database operation result
 */
async function saveVideo(videoData, menuType = 'music') {
  if (!videoData.youtubeVideoId) {
    throw new Error('Invalid video data - missing youtubeVideoId');
  }

  // Determine menu types (similar to your cron job logic)
  const menuTypes = [menuType];
  if (menuType === 'music') {
    menuTypes.push('trending');
  } else if (menuType === 'trending' && !videoData.isOfficialContent) {
    menuTypes.push('music');
  }

  const update = {
    $set: {
      ...videoData,
      lastUpdatedFromYouTube: new Date()
    },
    $setOnInsert: {
      createdAt: new Date()
    },
    $addToSet: { 
      menuTypes: { 
        $each: menuTypes 
      } 
    },
    $push: {
      updateHistory: {
        metrics: {
          views: videoData.views,
          likes: videoData.likes,
          dislikes: videoData.dislikes,
          commentCount: videoData.commentCount
        },
        updatedAt: new Date()
      }
    }
  };

  const result = await YoutubeVideoModel.findOneAndUpdate(
    { youtubeVideoId: videoData.youtubeVideoId },
    update,
    { upsert: true, new: true }
  );

  return result;
}

/**
 * Controller to fetch and store YouTube video by ID
 * @param {string} videoId YouTube video ID
 * @param {string} [menuType='videos'] Primary menu type for classification
 * @returns {Promise<Object>} The saved video document
 */
export async function fetchAndStoreVideoById(videoId, menuType = 'music') {
  try {
    logger.info(`Fetching video details for ID: ${videoId}`);
    
    // Get basic video info
    const searchResponse = await youtubeApi.get('/videos', {
      params: {
        part: 'snippet',
        id: videoId
      }
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      throw new Error('Video not found on YouTube');
    }

    const searchItem = searchResponse.data.items[0];
    
    // Get detailed statistics
    const details = await getVideoDetails(videoId);
    
    // Format the data
    const videoData = formatVideoData(searchItem, details);
    
    // Save to database
    const savedVideo = await saveVideo(videoData, menuType);
    
    logger.info(`Successfully stored video: ${videoId}`);
    return savedVideo;
  } catch (error) {
    logger.error(`Error processing video ${videoId}: ${error.message}`);
    throw error;
  }
}

// Example usage:
// fetchAndStoreVideoById('NnWe5Lhi0G8', 'music')
//   .then(video => console.log('Video stored:', video))
//   .catch(err => console.error('Error:', err));