import mongoose from 'mongoose';

/**
 * One row per purchase (never mutated into another tier). Status lifecycle:
 * pending → active → expired|cancelled. Idempotency: paystackReference unique.
 */
const membershipSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tier: {
      type: String,
      enum: ['free', 'fan_weekly', 'fan_monthly', 'fan_yearly'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paystackReference: { type: String, unique: true, sparse: true, index: true },
    amountNgn: { type: Number, required: true, min: 0 },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date, index: true },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

membershipSchema.index({ user: 1, status: 1, currentPeriodEnd: -1 });

export const MembershipModel = mongoose.model('Membership', membershipSchema);
export default MembershipModel;
