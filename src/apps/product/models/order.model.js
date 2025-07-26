import mongoose from 'mongoose';
import { orderItemSchema } from './ordered-item.model.js';
import { paymentInfoSchema } from './payment.model.js';

const orderSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  items: [orderItemSchema], // <-- FIXED: removed getter/setter
  paymentInfo: paymentInfoSchema,
  subtotal: {
    type: Number,
    required: true
  },
  shippingFee: {
    type: Number,
    required: true,
    default: 0
  },
  tax: {
    type: Number,
    required: true,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  },
  trackingNumber: String,
  carrier: String,
  estimatedDelivery: Date,
  notes: String
}, 
{ timestamps: true }
);

export const OrderModel = mongoose.model('Order', orderSchema);