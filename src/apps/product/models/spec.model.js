import mongoose from 'mongoose';

const productSpecSchema = mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    aspects: [
      {
        name: {
          type: String,
          required: true,
          trim: true
        },
        weight: {
          type: Number,
          min: 1,
          max: 10,
          default: 5
        },
        origin: {
          type: String,
          enum: ['manufacturer', 'user', 'expert'],
          default: 'user'
        },
        description: {
          type: String,
          trim: true,
          maxlength: 500
        },
        size: {
          type: String,
          trim: true,
          maxlength: 50
        },
        color: {
          type: String,
          trim: true,
          maxlength: 50
        },
        material: {
          type: String,
          trim: true,
          maxlength: 100
        }
      }
    ]
  },
  { timestamps: true }
);

export const ProductSpecModel = mongoose.model('ProductSpec', productSpecSchema);