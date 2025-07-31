import { WishlistModel } from '../models/wishlist.model.js';
import { ProductModel } from '../models/product.model.js';
import { UserModel } from '../../user/models/user.model.js';

// addToWishlist adds a product to the user's wishlist
// It checks if the product exists, creates a wishlist if it doesn't exist,
export const addToWishlist = async (req, res) => {
  try {
    const { productId, userId } = req.body;

    //console.log('Adding to wishlist:', { productId, userId });

    if (!productId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and User ID are required'
      });
    }

    // 1. Verify product exists
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // 2. Get or create user's wishlist
    let wishlist = await WishlistModel.findOne({ user: userId });

    if (!wishlist) {
      wishlist = new WishlistModel({
        user: userId,
        products: []
      });
    }

    // 3. Check if product already exists in wishlist
    const productExists = wishlist.products.some(item => 
      item.product.toString() === productId
    );

    if (productExists) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product already in wishlist' 
      });
    }

    // 4. Add product to wishlist
    wishlist.products.push({
      product: productId,
      addedAt: new Date()
    });

    // 5. Save the wishlist
    await wishlist.save();

    // 6. Update user's wishlist reference if not set
    const user = await UserModel.findById(userId);
    if (!user.shopping.wishlist) {
      user.shopping.wishlist = wishlist._id;
      await user.save();
    }

    // 7. Return updated wishlist
    const updatedWishlist = await WishlistModel.findById(wishlist._id)
      .populate({
        path: 'products.product',
        select: 'name price discountedPrice images'
      });

    res.status(200).json({
      success: true,
      wishlist: updatedWishlist,
      message: 'Product added to wishlist successfully'
    });

  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};


// getUserWishlist retrieves the wishlist for a specific user
// It populates the product details for each item in the wishlist.
export const getUserWishlist = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const wishlist = await WishlistModel.findOne({ user: userId })
      .populate({
        path: 'products.product',
        select: 'name price discountedPrice images brand isNewProduct isLimitedEdition rating inventory'
      });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        products: [],
        message: 'Wishlist not found'
      });
    }

    // Flatten products for frontend
    const products = wishlist.products.map(item => {
      const product = item.product;
      return {
        _id: product._id,
        name: product.name,
        price: product.price,
        discountedPrice: product.discountedPrice,
        images: product.images,
        brand: product.brand,
        isNewProduct: product.isNewProduct,
        isLimitedEdition: product.isLimitedEdition,
        rating: product.rating,
        inventory: product.inventory,
        addedAt: item.addedAt
      };
    });

    res.status(200).json({
      success: true,
      data: products,
      message: 'Wishlist retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({
      success: false,
      products: [],
      message: 'Internal server error',
      error: error.message
    });
  }
};