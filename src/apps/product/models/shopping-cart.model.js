import mongoose from 'mongoose';
import { cartItemSchema } from './cart-item.model.js'; // Add this import



const shoppingCartSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
  },
  { timestamps: true }
);

export const ShoppingCartModel = mongoose.model('ShoppingCart', shoppingCartSchema);