import mongoose from 'mongoose';


const wishlistSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    products: [{
        product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
        },
        addedAt: {
        type: Date,
        default: Date.now
        }
    }],
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

wishlistSchema.index({ user: 1, 'products.product': 1 }, { unique: true, sparse: true });

export const WishlistModel = mongoose.model('Wishlist', wishlistSchema);