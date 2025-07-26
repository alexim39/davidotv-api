import mongoose from 'mongoose';

const productSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter product name"],
      trim: true,
      maxlength: [100, "Product name cannot exceed 100 characters"]
    },
    description: {
      type: String,
      required: [true, "Please enter product description"],
      trim: true
    },
    price: {
      type: Number,
      required: [true, "Please enter product price"],
      min: [0, "Price cannot be negative"]
    },
    discountedPrice: {
      type: Number,
      validate: {
        validator: function(value) {
          return value < this.price;
        },
        message: "Discounted price must be less than regular price"
      }
    },
    images: [{
      url: String,
      altText: String
    }],
    categories: [{
      type: String,
      enum: ['apparel', 'accessories', 'home', 'music', 'collectibles', 'limited-edition'],
      required: true
    }],
    type: {
      type: String,
      enum: ['standard', 'premium', 'exclusive', 'limited-edition'],
      default: 'standard'
    },
    variants: [{
      name: String, // e.g., "Size", "Color"
      options: [String] // e.g., ["S", "M", "L"], ["Red", "Blue"]
    }],
    inventory: {
      stock: {
        type: Number,
        required: true,
        min: [0, "Stock cannot be negative"],
        default: 0
      },
      sku: {
        type: String,
        unique: true,
        trim: true
      },
      barcode: String
    },
    rating: {
      average: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
      },
      count: {
        type: Number,
        default: 0
      }
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    isNew: {
      type: Boolean,
      default: false
    },
    isLimitedEdition: {
      type: Boolean,
      default: false
    },
    releaseDate: {
      type: Date,
      default: Date.now
    },
    relatedProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }],
    tags: [String],
    shippingInfo: {
      weight: Number, // in grams
      dimensions: {
        length: Number,
        width: Number,
        height: Number
      },
      isDigital: {
        type: Boolean,
        default: false
      }
    },
    brand: {
      type: String,
      default: "Davido Official"
    },
    artistCollection: {
      type: String,
      enum: ['davido', '30bg', 'other'],
      default: 'davido'
    }
  },
  { timestamps: true }
);



export const ProductModel = mongoose.model('Product', productSchema);


