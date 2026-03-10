import { Order, OrderItem, Cart, CartItem, Product, sequelize } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';
import { MSG } from '../../utils/message.js';

/**
 * @desc Place order from cart
 */
export const placeOrder = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { deliveryAddress, latitude, longitude } = req.body;

  // 1. Get User's Cart
  const cart = await Cart.findOne({
    where: { userId },
    include: [{ model: CartItem }]
  });

  if (!cart || cart.CartItems.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Cart is empty");
  }

  // 2. Group items by sellerId to create multiple orders if needed
  const itemsBySeller = cart.CartItems.reduce((acc, item) => {
    if (!acc[item.sellerId]) acc[item.sellerId] = [];
    acc[item.sellerId].push(item);
    return acc;
  }, {});

  const createdOrders = [];

  // 3. Create Orders (Transactionally)
  const result = await sequelize.transaction(async (t) => {
    for (const sellerId in itemsBySeller) {
      const items = itemsBySeller[sellerId];
      const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
      const commissionAmount = totalAmount * 0.10; // 10% commission

      // Create Order
      const order = await Order.create({
        userId,
        sellerId,
        totalAmount,
        commissionAmount,
        deliveryAddress,
        latitude,
        longitude,
        orderNumber: `FB-${Date.now()}-${sellerId}`,
        location: latitude && longitude ? { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] } : null
      }, { transaction: t });

      // Create Order Items and Update Stock
      for (const item of items) {
        const product = await Product.findByPk(item.productId, { transaction: t });
        
        if (!product || product.stock < item.quantity) {
          throw new ApiError(StatusCodes.BAD_REQUEST, `Product ${product?.productName || 'unknown'} is out of stock`);
        }

        // Decrement stock
        await product.update({ 
          stock: product.stock - item.quantity,
          status: (product.stock - item.quantity) === 0 ? 'out-of-stock' : product.status
        }, { transaction: t });

        await OrderItem.create({
          OrderId: order.id,
          ProductId: item.productId,
          quantity: item.quantity,
          price: item.price
        }, { transaction: t });
      }

      createdOrders.push(order);
    }

    // 4. Clear Cart
    await CartItem.destroy({ where: { cartId: cart.id }, transaction: t });
    
    return createdOrders;
  });

  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: "Order(s) placed successfully",
    data: result
  });
});

/**
 * @desc Get User Orders
 */
export const getUserOrders = catchAsync(async (req, res) => {
  const orders = await Order.findAll({
    where: { userId: req.user.id },
    include: [{ model: Product, through: { attributes: ['quantity', 'price'] } }],
    order: [['createdAt', 'DESC']]
  });

  return successResponse({
    res,
    message: "User orders fetched",
    data: orders
  });
});

/**
 * @desc Get Seller Orders
 */
export const getSellerOrders = catchAsync(async (req, res) => {
  const orders = await Order.findAll({
    where: { sellerId: req.user.id },
    include: [{ model: Product, through: { attributes: ['quantity', 'price'] } }],
    order: [['createdAt', 'DESC']]
  });

  return successResponse({
    res,
    message: "Seller orders fetched",
    data: orders
  });
});

/**
 * @desc Update Order Status (Seller/Admin/Partner)
 */
export const updateOrderStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const order = await Order.findByPk(id);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  // Basic authorization: Only the seller of this order or admin can update status
  if (req.role !== 'admin' && order.sellerId !== req.user.id) {
     throw new ApiError(StatusCodes.FORBIDDEN, "Not authorized to update this order");
  }

  await order.update({ status });

  return successResponse({
    res,
    message: `Order status updated to ${status}`,
    data: order
  });
});
