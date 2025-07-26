import mongoose from 'mongoose';


const paymentInfoSchema = mongoose.Schema({
  method: {
    type: String,
    enum: ['credit_card', 'paypal', 'bank_transfer', 'crypto', 'other'],
    required: true
  },
  transactionId: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentDate: {
    type: Date,
    default: Date.now
  }
  },
  {
    timestamps: true
  }
);

export const PaymentInfoModel = mongoose.model('PaymentInfo', paymentInfoSchema);