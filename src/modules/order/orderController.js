import { Order, OrderItem, Cart, CartItem, Product, Seller, DeliveryPartner, sequelize } from '../../models/index.js';
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
  const { deliveryAddress, latitude, longitude, paymentMethod } = req.body;

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
  const deliveryFeePerSeller = 25; // Simple flat fee for each seller order

  // Create a unique group ID for this checkout session
  const groupId = `GRP-${Date.now()}-${userId}`;

  // 3. Create Orders (Transactionally)
  const result = await sequelize.transaction(async (t) => {
    for (const sellerId in itemsBySeller) {
      const items = itemsBySeller[sellerId];
      const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
      const orderTotal = itemsTotal + deliveryFeePerSeller;
      const commissionAmount = itemsTotal * 0.20; // 20% admin commission

      // Create Order
      const order = await Order.create({
        userId,
        sellerId,
        groupId,
        totalAmount: orderTotal,
        deliveryFee: deliveryFeePerSeller,
        commissionAmount,
        deliveryAddress,
        latitude,
        longitude,
        paymentMethod: paymentMethod || 'cod',
        paymentStatus: paymentMethod === 'stripe' ? 'paid' : 'unpaid',
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
    data: {
      confirmation: "Your order has been placed successfully!",
      groupId: groupId,
      orders: result.map(o => ({
        orderNumber: o.orderNumber,
        totalAmount: o.totalAmount,
        status: o.status
      }))
    }
  });
});

/**
 * @desc Get User Orders
 */
export const getUserOrders = catchAsync(async (req, res) => {
  const orders = await Order.findAll({
    where: { userId: req.user.id },
    include: [
      { model: Product, through: { attributes: ['quantity', 'price'] } },
      { model: sequelize.models.Seller, attributes: ['shop_name'] }
    ],
    order: [['createdAt', 'DESC']]
  });

  // Group orders by groupId so user sees ONE invoice per checkout
  const groupedOrders = {};

  orders.forEach(order => {
    const gId = order.groupId || order.orderNumber; // Fallback for old orders
    if (!groupedOrders[gId]) {
      groupedOrders[gId] = {
        id: order.id, // Using first order's ID as representative
        orderNumber: gId,
        totalAmount: 0, // Will accumulate
        status: order.status, // Will use first order's status, or compute overall
        createdAt: order.createdAt,
        OrderSellers: []
      };
    }

    // Accumulate total
    groupedOrders[gId].totalAmount += parseFloat(order.totalAmount);

    // Add seller order info
    groupedOrders[gId].OrderSellers.push({
      sellerId: order.sellerId,
      amount: order.totalAmount,
      status: order.status,
      Seller: order.Seller
    });
  });

  // Convert map to array and format amounts to 2 decimal places
  const resultData = Object.values(groupedOrders).map(grp => ({
    ...grp,
    totalAmount: grp.totalAmount.toFixed(2)
  }));

  // Sort by createdAt descending
  resultData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return successResponse({
    res,
    message: "User orders fetched",
    data: resultData
  });
});

/**
 * @desc Track Single Order
 * GET /api/orders/track/:orderNumber
 */
export const trackOrder = catchAsync(async (req, res) => {
  const { orderNumber } = req.params;

  const order = await Order.findOne({
    where: { orderNumber },
    include: [
      { model: Product, through: { attributes: ['quantity', 'price'] } },
      { model: Seller, attributes: ['id', 'shop_name', 'address', 'phone'] },
      {
        model: DeliveryPartner,
        as: 'DeliveryPartner', // Need to check if alias is set in models/index.js
        attributes: ['id', 'name', 'phone', 'vehicleType', 'vehicleNumber', 'latitude', 'longitude']
      }
    ]
  });

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  // Basic security: only owner can track (unless admin/seller/partner)
  if (req.role === 'user' && order.userId !== req.user.id) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Not authorized to track this order");
  }

  return successResponse({
    res,
    message: "Tracking details fetched",
    data: order
  });
});

/**
 * @desc Get Seller Orders
 */
export const getSellerOrders = catchAsync(async (req, res) => {
  try {
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
  } catch (error) {
    console.error("Error in getSellerOrders:", error);
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, error.message || "Failed to fetch seller orders");
  }
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

  // Trigger Notification
  import('../../utils/notificationService.js').then(({ notifyOrderStatusChange }) => {
    notifyOrderStatusChange(order);
  }).catch(err => console.error("Notification failed", err));

  return successResponse({
    res,
    message: `Order status updated to ${status}`,
    data: order
  });
});
