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
import { addToWishlist } from '../controllers/wishlist.controller.js';


const StoreRouter = express.Router();

// Add products route
StoreRouter.post('/add', addProducts);

// Main products route with filtering
StoreRouter.get('/', getProducts);

// Shortcut routes working with specific product categories
StoreRouter.get('/featured', getFeaturedProducts);
StoreRouter.get('/new', getNewArrivals);
StoreRouter.get('/limited', getLimitedEdition);

// Single product routes
StoreRouter.get('/:id', getProductById);
StoreRouter.get('/:id/related', getRelatedProducts);

// Cart routes
StoreRouter.post('/cart/add', addToCart);
StoreRouter.post('/wishlist/add', addToWishlist);

export default StoreRouter;