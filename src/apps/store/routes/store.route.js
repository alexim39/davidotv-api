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


const StoreRouter = express.Router();

// Add products route
StoreRouter.post('/add', addProducts);

// Main products route with filtering
StoreRouter.get('/', getProducts);

// Shortcut routes
StoreRouter.get('/featured', getFeaturedProducts);
StoreRouter.get('/new', getNewArrivals);
StoreRouter.get('/limited', getLimitedEdition);

// Single product routes
StoreRouter.get('/:id', getProductById);
StoreRouter.get('/:id/related', getRelatedProducts);

export default StoreRouter;