/**
 * YouTube pipeline config - single source of truth for cron + API.
 */
export const youtubeConfig = {
  apiKey: process.env.YOUTUBE_API_KEY || 'AIzaSyCnqQosiJ2hFLBMQM691p61f2mkkpg6Q7Y',
  apiUrl: 'https://www.googleapis.com/youtube/v3/search',
  videosUrl: 'https://www.googleapis.com/youtube/v3/videos',
  channelIds: (process.env.OFFICIAL_CHANNEL_IDS?.split(',') ?? ['UCkBV3nBa0iRdxEGc4DUS3xA', 'UCQJOYS9v30qM74f6gZDk0TA']).map(s => s.trim()),
  maxResults: 50,
  cron: {
    trending: process.env.CRON_TRENDING || '7 */7 * * *',
    music: process.env.CRON_MUSIC || '23 0,12 * * *',
    videos: process.env.CRON_VIDEOS || '11 */5 * * *',
    metrics: process.env.CRON_METRICS || '37 */3 * * *',
  },
  app: {
    maxRetries: 3,
    retryDelay: 5000,
    trendingPeriodDays: 30,
    batchSize: 5,
  },
  cacheTtlMs: 6 * 60 * 60 * 1000, // 6h - BE serves cached, cron refreshes
};

export default youtubeConfig;
