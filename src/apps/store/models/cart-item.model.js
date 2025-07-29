import mongoose from 'mongoose';

const cartItemSchema = mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity cannot be less than 1"],
    default: 1
  },
  selectedVariant: {
    name: String,
    option: String
  },
  priceAtAddition: {
    type: Number,
    required: true
  }
  },
    {
        timestamps: true
    }
);

export const CartItemModel = mongoose.model('CartItem', cartItemSchema);