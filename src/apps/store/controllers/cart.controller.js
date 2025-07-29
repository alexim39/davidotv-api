import { CartItemModel, } from '../models/cart-item.model.js';
import { ShoppingCartModel } from '../models/shopping-cart.model.js';
import { ProductModel } from '../models/product.model.js';
import { UserModel } from '../../user/models/user.model.js';

export const addToCart = async (req, res) => {
  try {
    const { productId, userId, quantity = 1, selectedVariant } = req.body;

    if (!productId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and User ID are required'
      });
    }

    // 1. Verify product exists and get current price
    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // 2. Check stock availability
    if (product.inventory.stock < quantity) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient stock',
        availableStock: product.inventory.stock
      });
    }

    // 3. Get or create user's shopping cart
    let cart = await ShoppingCartModel.findOne({ user: userId })
      .populate('items.product');

    if (!cart) {
      cart = new ShoppingCartModel({
        user: userId,
        items: []
      });
    }

    // 4. Check if product already exists in cart
    const existingItemIndex = cart.items.findIndex(item => 
      item.product._id.toString() === productId &&
      (!selectedVariant || 
       (item.selectedVariant?.name === selectedVariant.name && 
        item.selectedVariant?.option === selectedVariant.option))
    );

    const priceToUse = product.discountedPrice || product.price;

    if (existingItemIndex >= 0) {
      // Update quantity if item exists
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item to cart
      const newCartItem = new CartItemModel({
        product: productId,
        quantity,
        selectedVariant,
        priceAtAddition: priceToUse
      });
      cart.items.push(newCartItem);
    }

    // 5. Save the cart
    await cart.save();

    // 6. Update user's cart reference if not set
    const user = await UserModel.findById(userId);
    if (!user.shopping.cart) {
      user.shopping.cart = cart._id;
      await user.save();
    }

    // 7. Return updated cart
    const updatedCart = await ShoppingCartModel.findById(cart._id)
      .populate({
        path: 'items.product',
        select: 'name price discountedPrice images inventory'
      });

    res.status(200).json({
      success: true,
      cart: updatedCart,
      message: 'Product added to cart successfully'
    });

  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
};