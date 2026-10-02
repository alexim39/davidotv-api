import cron from 'node-cron';
import axios from 'axios';
import rateLimit from 'axios-rate-limit';
import { YoutubeVideoModel } from '../../apps/youtube/models/youtube.model.js';
import youtubeConfig from '../../config/youtube.js';
import logger from '../../config/logger.js';
import { clearCache } from './youtube.service.js';

/**
 * Refactored YouTube pipeline - single file replaces crawler{,2,3}.js
 * - Structured caching: serves cached MongoDB lists via API
 * - Daily cron sync to bypass quota (axios-rate-limit 50 req/s)
 * - Graceful retries + Winston logs
 */

const youtubeApi = rateLimit(axios.create({ timeout: 10000 }), { maxRequests: 50, perMilliseconds: 1000 });

/** SEC-04: surface quota exhaustion loudly so on-call notices before the catalog goes stale. */
const isQuotaError = (e) =>
  e?.response?.status === 403 &&
  (e?.response?.data?.error?.errors || []).some((x) => x?.reason === 'quotaExceeded');

const logApiError = (where, e, extra = {}) => {
  if (isQuotaError(e)) {
    logger.error('YouTube QUOTA EXCEEDED — catalog sync paused by Google, check API console', { where, ...extra });
  } else {
    logger.error(where, { error: e.message, ...extra });
  }
};

function determineMenuTypes(video, primary) {
  const t = [primary];
  if (primary === 'music') t.push('trending');
  else if (primary === 'trending' && !video.isOfficialContent) t.push('videos');
  return t;
}

async function formatVideoData(item, details = {}) {
  if (!item?.id?.videoId || !item?.snippet) throw new Error('Invalid item');
  const isOfficial = youtubeConfig.channelIds.includes(item.snippet.channelId);
  let seconds = 0;
  const dur = details.duration || '';
  if (dur) {
    const m = dur.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
    if (m) seconds = (parseInt(m[1]||'0')*60)+ parseInt(m[2]||'0');
  }
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
      maxres: item.snippet.thumbnails?.maxres?.url || '',
    },
    duration: dur,
    durationSeconds: seconds,
    isShort: seconds <= 120,
    views: details.viewCount || 0,
    likes: details.likeCount || 0,
    dislikes: details.dislikeCount || 0,
    commentCount: details.commentCount || 0,
    isOfficialContent: isOfficial,
    tags: item.snippet.tags || details.tags || [],
    lastUpdatedFromYouTube: new Date(),
  };
}

async function getVideoDetails(videoId, retries = youtubeConfig.app.maxRetries) {
  try {
    const { data } = await youtubeApi.get(youtubeConfig.videosUrl, {
      params: { part: 'snippet,contentDetails,statistics', id: videoId, key: youtubeConfig.apiKey }
    });
    const item = data.items?.[0];
    if (!item) return {};
    return {
      duration: item.contentDetails?.duration,
      viewCount: parseInt(item.statistics?.viewCount || 0),
      likeCount: parseInt(item.statistics?.likeCount || 0),
      dislikeCount: parseInt(item.statistics?.dislikeCount || 0),
      commentCount: parseInt(item.statistics?.commentCount || 0),
      tags: item.snippet?.tags || [],
    };
  } catch (e) {
    if (isQuotaError(e)) { logApiError('getVideoDetails quota', e, { videoId }); return {}; } // no retry on quota
    if (retries > 0) { await new Promise(r=> setTimeout(r, youtubeConfig.app.retryDelay)); return getVideoDetails(videoId, retries-1); }
    logApiError('getVideoDetails failed', e, { videoId });
    return {};
  }
}

async function saveVideos(videos, menuType) {
  const ops = [];
  for (const v of videos) {
    if (!v.youtubeVideoId) continue;
    ops.push({
      updateOne: {
        filter: { youtubeVideoId: v.youtubeVideoId },
        update: {
          $set: { ...v, lastUpdatedFromYouTube: new Date() },
          $setOnInsert: { createdAt: new Date() },
          $addToSet: { menuTypes: { $each: determineMenuTypes(v, menuType) } }
        },
        upsert: true
      }
    });
  }
  if (!ops.length) return;
  const res = await YoutubeVideoModel.bulkWrite(ops);
  logger.info('YouTube bulkWrite', { menuType, upserted: res.upsertedCount, modified: res.modifiedCount });
  clearCache(); // invalidate API cache after write
}

async function processInBatches(items, fn, batchSize = youtubeConfig.app.batchSize) {
  for (let i=0;i<items.length;i+=batchSize) {
    const batch = items.slice(i,i+batchSize);
    try { await fn(batch); await new Promise(r=> setTimeout(r, 1500)); }
    catch (e) { logger.error('Batch failed', { error: e.message, batch: `${i}-${i+batchSize}` }); }
  }
}

export const startCronJobs = () => {
  // Trending
  cron.schedule(youtubeConfig.cron.trending, async () => {
    logger.info('Cron: trending sync');
    try {
      const { data } = await youtubeApi.get(youtubeConfig.apiUrl, {
        params: {
          part: 'snippet', q: 'Davido', type: 'video', maxResults: youtubeConfig.maxResults,
          order: 'viewCount', regionCode: 'NG', key: youtubeConfig.apiKey,
          publishedAfter: new Date(Date.now() - youtubeConfig.app.trendingPeriodDays*86400000).toISOString()
        }
      });
      if (!data?.items?.length) return;
      await processInBatches(data.items, async batch=>{
        const vids = await Promise.all(batch.map(async it=> {
          try { const d = await getVideoDetails(it.id.videoId); return await formatVideoData(it,d); } catch(e){ logger.error('format failed', { error:e.message }); return null; }
        }));
        await saveVideos(vids.filter(Boolean), 'trending');
      });
      logger.info('Cron trending done', { count: data.items.length });
    } catch (e) { logApiError('Cron trending error', e); }
  });

  // Music (official)
  cron.schedule(youtubeConfig.cron.music, async ()=>{
    logger.info('Cron: music sync');
    for (const channelId of youtubeConfig.channelIds) {
      try {
        const { data } = await youtubeApi.get(youtubeConfig.apiUrl, { params: { part:'snippet', channelId, type:'video', maxResults: youtubeConfig.maxResults, order:'date', key: youtubeConfig.apiKey }});
        if (!data?.items?.length) continue;
        await processInBatches(data.items, async batch=>{
          const vids = await Promise.all(batch.map(async it=>{
            const d = await getVideoDetails(it.id.videoId);
            const vd = await formatVideoData(it,d); vd.isOfficialContent=true; return vd;
          }));
          await saveVideos(vids, 'music');
        });
      } catch(e){ logApiError('Cron music channel failed', e, { channelId }); }
    }
  });

  // Metrics refresh for stale (6h)
  cron.schedule(youtubeConfig.cron.metrics, async ()=>{
    logger.info('Cron: metrics refresh');
    const stale = await YoutubeVideoModel.find({ lastUpdatedFromYouTube: { $lt: new Date(Date.now()-6*3600000) } }).limit(100).lean();
    if (!stale.length) return;
    await processInBatches(stale, async batch=>{
      const ops = await Promise.all(batch.map(async v=>{
        try{
          const d = await getVideoDetails(v.youtubeVideoId);
          return { updateOne: { filter:{_id:v._id}, update:{ $set:{ views:d.viewCount??v.views, likes:d.likeCount??v.likes, commentCount:d.commentCount??v.commentCount, lastUpdatedFromYouTube:new Date() } } } };
        }catch(e){ return null; }
      }));
      const filtered = ops.filter(Boolean);
      if (filtered.length) await YoutubeVideoModel.bulkWrite(filtered);
    });
    clearCache();
    logger.info('Cron metrics done');
  });

  logger.info('YouTube cron jobs scheduled', { crons: youtubeConfig.cron });
};

export default { startCronJobs };
