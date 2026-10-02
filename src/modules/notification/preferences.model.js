import mongoose from 'mongoose';

/**
 * NOT-01: per-user notification preferences.
 * - Channel switches (push/email/inApp) + per-type mutes.
 * - In-app (bell) is core and cannot be muted — only push/email yield.
 * - Unknown type strings are ignored on write (forward-compatible).
 */
const preferencesSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    push: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    mutedTypes: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const NotificationPreferenceModel = mongoose.model('NotificationPreference', preferencesSchema);
export default NotificationPreferenceModel;
