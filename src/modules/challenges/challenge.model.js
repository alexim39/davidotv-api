import mongoose from 'mongoose';

/**
 * Fan challenges (dance/cover/remix contests).
 * Ranking reuses TalentUpload engagement (likes/plays) — no parallel voting
 * system. Winner is declared by admin; entries link existing uploads.
 */
const entrySchema = new mongoose.Schema(
  {
    upload: { type: mongoose.Schema.Types.ObjectId, ref: 'TalentUpload', required: true },
    entrant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    enteredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const challengeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    hashtag: { type: String, trim: true, maxlength: 60 },
    status: {
      type: String,
      enum: ['draft', 'active', 'judging', 'closed'],
      default: 'draft',
      index: true,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    entries: { type: [entrySchema], default: [] },
    winnerUpload: { type: mongoose.Schema.Types.ObjectId, ref: 'TalentUpload' },
    decidedAt: { type: Date },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

challengeSchema.index({ status: 1, endsAt: 1 });
challengeSchema.index({ 'entries.upload': 1 });

export const ChallengeModel = mongoose.model('Challenge', challengeSchema);
export default ChallengeModel;
