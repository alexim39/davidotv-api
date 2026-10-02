import { AnalyticsEventModel, CONSUMPTION_TYPES, PARTICIPATION_TYPES, EVENT_TYPES } from './analytics.model.js';
import logger from '../../config/logger.js';

/**
 * WEF-01: Weekly Engaged Fans.
 * WEF_CONFIG is the documented, configurable threshold set (§4):
 * - windowDays: trailing window
 * - A fan counts when they log ≥1 consumption AND ≥1 participation inside it.
 */
export const WEF_CONFIG = Object.freeze({
  windowDays: 7,
});

export const track = async ({ userId, type, refId, meta, at }) => {
  if (!EVENT_TYPES.includes(type)) {
    throw Object.assign(new Error(`Unknown event type: ${type}`), { statusCode: 400 });
  }
  const doc = await AnalyticsEventModel.create({ userId, type, refId, meta, at });
  return doc;
};

/**
 * Computes WEF for the trailing window ending at `now`.
 * Single aggregation: users having both action classes.
 */
export const computeWef = async ({ now = new Date(), windowDays = WEF_CONFIG.windowDays } = {}) => {
  const since = new Date(now.getTime() - windowDays * 86400000);
  const rows = await AnalyticsEventModel.aggregate([
    { $match: { at: { $gte: since, $lte: now } } },
    {
      $group: {
        _id: '$userId',
        hasConsumption: { $max: { $in: ['$type', CONSUMPTION_TYPES] } },
        hasParticipation: { $max: { $in: ['$type', PARTICIPATION_TYPES] } },
      },
    },
    { $match: { hasConsumption: true, hasParticipation: true } },
    { $count: 'wef' },
  ]);
  const wef = rows[0]?.wef ?? 0;
  logger.info('WEF computed', { wef, windowDays });
  return { wef, windowDays, since, computedAt: now };
};

export default { WEF_CONFIG, track, computeWef };
