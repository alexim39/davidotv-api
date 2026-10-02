import mongoose from 'mongoose';

/**
 * WEF analytics (§4 master prompt, WEF-01 backlog).
 * One row per meaningful action. Thresholds live in analytics.service.js
 * (WEF_CONFIG) — documented, configurable, validated here by tests.
 */
export const CONSUMPTION_TYPES = Object.freeze([
  'video_watch',
  'audio_listen',
  'livestream_attend',
  'event_view',
  'talent_view',
]);

export const PARTICIPATION_TYPES = Object.freeze([
  'like',
  'comment',
  'reply',
  'share',
  'save',
  'follow',
  'post',
  'upload',
  'vote',
  'attend',
  'purchase',
  'benefit_use',
]);

export const EVENT_TYPES = Object.freeze([...CONSUMPTION_TYPES, ...PARTICIPATION_TYPES]);

const analyticsEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, enum: EVENT_TYPES, required: true, index: true },
    refId: { type: String, trim: true }, // video/upload/event/order id
    meta: { type: mongoose.Schema.Types.Mixed },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

analyticsEventSchema.index({ userId: 1, at: -1 });
analyticsEventSchema.index({ type: 1, at: -1 });

export const AnalyticsEventModel = mongoose.model('AnalyticsEvent', analyticsEventSchema);
export default AnalyticsEventModel;
