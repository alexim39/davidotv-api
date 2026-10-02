import mongoose from 'mongoose';


const paymentInfoSchema = mongoose.Schema({
  method: {
    type: String,
    // 'paystack' added for the orders module (previously unused collection).
    enum: ['credit_card', 'paypal', 'bank_transfer', 'crypto', 'paystack', 'other'],
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

// Exported for order.model.js (previously missing — importing OrderModel crashed).
export { paymentInfoSchema };
export const PaymentInfoModel = mongoose.model('PaymentInfo', paymentInfoSchema);