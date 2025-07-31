import express from 'express';

import { 
  addProducts,
  getProducts,
  getProductById,
  getRelatedProducts,
  getFeaturedProducts,
  getNewArrivals,
  getLimitedEdition
} from '../controllers/product.controller.js'
import { addToCart } from '../controllers/cart.controller.js';
import { addToWishlist, getUserWishlist } from '../controllers/wishlist.controller.js';


const StoreRouter = express.Router();



// Main products route with filtering
StoreRouter.get('/', getProducts);

// Add products route
StoreRouter.post('/add', addProducts);

StoreRouter.post('/cart/add', addToCart);

// Shortcut routes working with specific product categories
StoreRouter.get('/featured', getFeaturedProducts);
StoreRouter.get('/new', getNewArrivals);
StoreRouter.get('/limited', getLimitedEdition);

// Single product routes
StoreRouter.get('/:id', getProductById);
StoreRouter.get('/:id/related', getRelatedProducts);

// Cart routes

StoreRouter.post('/wishlist/add', addToWishlist);
StoreRouter.get('/wishlist/:userId', getUserWishlist);

export default StoreRouter;