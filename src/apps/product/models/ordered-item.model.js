import mongoose from 'mongoose';


const orderItemSchema = mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity cannot be less than 1"]
  },
  priceAtPurchase: {
    type: Number,
    required: true
  },
  selectedVariant: {
    name: String,
    option: String
  }
  }, 
  {
    timestamps: true
    } 
);

export const OrderItemModel = mongoose.model('OrderItem', orderItemSchema);