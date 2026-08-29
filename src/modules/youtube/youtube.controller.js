import * as svc from './youtube.service.js';
import logger from '../../config/logger.js';

/**
 * Thin controller - delegates to service, handles HTTP.
 */
export const getVideos = async (req, res, next) => {
  try {
    const { menuType, isOfficialContent, isShort, limit, page, sort } = req.query;
    const result = await svc.getVideosCached({ menuType, isOfficialContent, isShort, limit, page, sort });
    res.json({ success: true, ...result, data: result.data.map(v=> ({ ...v, url: `https://www.youtube.com/watch?v=${v.youtubeVideoId}` })) });
  } catch (e) { logger.error('youtube/getVideos failed', { error: e.message }); next(e); }
};

export const getVideoById = async (req, res, next) => {
  try {
    const video = await svc.getVideoByIdCached(req.params.id);
    if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
    res.json({ success: true, data: { ...video, url: `https://www.youtube.com/watch?v=${video.youtubeVideoId}` } });
  } catch (e) { next(e); }
};

export const searchVideos = async (req, res, next) => {
  try {
    const { search, limit, page, isOfficial } = req.query;
    if (!search?.trim()) return res.status(400).json({ success: false, message: 'Search query required' });
    const result = await svc.searchCached({ search, limit, page, isOfficial });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
};

export default { getVideos, getVideoById, searchVideos };
