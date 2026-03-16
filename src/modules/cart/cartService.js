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
  async addToCart(userId, productId, sellerId, quantity) {
    const cart = await this.getOrCreateCart(userId);
    const product = await Product.findByPk(productId);
    if (!product) throw new Error('Product not found');

    // Check if item already exists in cart
    let cartItem = await CartItem.findOne({
      where: { cartId: cart.id, productId, sellerId }
    });

    if (cartItem) {
      // Update quantity
      cartItem.quantity += parseInt(quantity);
      cartItem.priceAtPurchase = product.finalPrice || product.price;
      cartItem.discountPercent = product.discountPercent || 0;
      cartItem.discountAmount = product.discountAmount || 0;
      await cartItem.save();
    } else {
      // Create new item
      cartItem = await CartItem.create({
        cartId: cart.id,
        productId,
        sellerId,
        quantity,
        priceAtPurchase: product.finalPrice || product.price,
        discountPercent: product.discountPercent || 0,
        discountAmount: product.discountAmount || 0
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
            { model: Product, attributes: ['productName', 'images', 'unit', 'price', 'originalPrice', 'discountAmount'] },
            { model: Seller, attributes: ['shop_name'] }
          ]
        }
      ]
    });

    if (!cart || !cart.CartItems.length) return { items: [], subtotal: 0, totalAmount: 0, savings: 0 };

    let itemTotal = 0;
    let totalSavings = 0;

    const items = cart.CartItems.map(item => {
      const product = item.Product;
      const currentPrice = parseFloat(item.priceAtPurchase || 0);
      const discountAmount = parseFloat(item.discountAmount || 0);
      
      const total = currentPrice * item.quantity;
      itemTotal += total;
      totalSavings += (discountAmount * item.quantity);

      return {
        ...item.toJSON(),
        price: currentPrice.toFixed(2),
        itemTotal: total.toFixed(2),
        discountPercent: item.discountPercent,
        discountAmount: discountAmount.toFixed(2),
        productName: product?.productName,
        images: product?.images,
        originalPrice: product?.originalPrice
      };
    });

    // Zepto Logic: 
    // If Item Total >= 200 -> Handling Fee 4, Delivery FREE
    // Else -> Delivery Fee 20, Handling Fee (optional, let's keep it 4 or 0. User said: Else Delivery 20)
    
    let handlingFee = 4;
    let deliveryFee = 0;

    if (itemTotal >= 200) {
      deliveryFee = 0;
    } else {
      deliveryFee = 20;
    }

    // Promotional Offer Logic:
    // Order above ₹1000 -> Get ₹50 OFF
    let promoDiscount = 0;
    if (itemTotal >= 1000) {
      promoDiscount = 50;
    }

    const totalAmount = itemTotal + handlingFee + deliveryFee - promoDiscount;

    return {
      items,
      itemTotal: itemTotal.toFixed(2),
      handlingFee: handlingFee.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      totalSavings: (totalSavings + promoDiscount).toFixed(2),
      promoDiscount: promoDiscount.toFixed(2),
      totalAmount: totalAmount.toFixed(2)
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
