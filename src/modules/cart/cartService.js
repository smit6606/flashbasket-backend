import { Cart, CartItem, Product, Seller } from '../../models/index.js';

class CartService {
  /**
   * Get or Create a Cart for the user
   */
  async getOrCreateCart(userId) {
    let cart = await Cart.findOne({ where: { userId } });
    if (!cart) {
      cart = await Cart.create({ userId });
    }
    return cart;
  }

  /**
   * Add Item to Cart
   */
  async addToCart(userId, productId, sellerId, quantity, price) {
    const cart = await this.getOrCreateCart(userId);

    // Check if item already exists in cart
    let cartItem = await CartItem.findOne({
      where: { cartId: cart.id, productId, sellerId }
    });

    if (cartItem) {
      // Update quantity
      cartItem.quantity += parseInt(quantity);
      await cartItem.save();
    } else {
      // Create new item
      cartItem = await CartItem.create({
        cartId: cart.id,
        productId,
        sellerId,
        quantity,
        price
      });
    }

    return cartItem;
  }

  /**
   * Get Cart Items with Totals
   */
  async getCart(userId) {
    const cart = await Cart.findOne({
      where: { userId },
      include: [
        {
          model: CartItem,
          include: [
            { model: Product, attributes: ['productName', 'images', 'unit'] },
            { model: Seller, attributes: ['shop_name'] }
          ]
        }
      ]
    });

    if (!cart || !cart.CartItems.length) return null;

    let subtotal = 0;
    const items = cart.CartItems.map(item => {
      const total = parseFloat(item.price) * item.quantity;
      subtotal += total;
      return {
        ...item.toJSON(),
        itemTotal: total.toFixed(2)
      };
    });

    return {
      items,
      subtotal: subtotal.toFixed(2)
    };
  }

  /**
   * Update Item Quantity
   */
  async updateQuantity(userId, cartItemId, quantity) {
    const cart = await Cart.findOne({ where: { userId } });
    if (!cart) return null;

    const cartItem = await CartItem.findOne({
      where: { id: cartItemId, cartId: cart.id }
    });

    if (!cartItem) return null;

    cartItem.quantity = quantity;
    await cartItem.save();
    return cartItem;
  }

  /**
   * Remove Item from Cart
   */
  async removeFromCart(userId, cartItemId) {
    const cart = await Cart.findOne({ where: { userId } });
    if (!cart) return null;

    return await CartItem.destroy({
      where: { id: cartItemId, cartId: cart.id }
    });
  }
}

export default new CartService();
