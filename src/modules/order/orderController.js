import { Order, OrderItem, Cart, CartItem, Product, Seller, DeliveryPartner, User, sequelize } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';
import { MSG } from '../../utils/message.js';
import { buildQuery, formatPaginatedResponse } from '../../utils/queryHelper.js';
import { io } from "../../../server.js";
import { Op } from 'sequelize';
import Stripe from 'stripe';

/**
 * @desc Place order from cart
 */
export const placeOrder = catchAsync(async (req, res) => {
  const user = req.user;
  const userId = user.id;

  if (user.status === 'restricted') {
      throw new ApiError(StatusCodes.FORBIDDEN, "Your purchasing privileges have been restricted by the admin. Please contact support.");
  }

  const { deliveryAddress, latitude, longitude, paymentMethod, couponId, discountAmount } = req.body;

  // 1. Get User's Cart
  const cart = await Cart.findOne({
    where: { userId },
    include: [{ model: CartItem }]
  });

  if (!cart || cart.CartItems.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Cart is empty");
  }

  // 2. Resolve items across sellers if stock is insufficient
  const resolvedItems = [];
  for (const item of cart.CartItems) {
    const originalProduct = await Product.findByPk(item.productId);
    if (!originalProduct) continue;

    let remainingQuantity = item.quantity;

    if (originalProduct.stock >= remainingQuantity) {
      const finalPrice = originalProduct.discountPrice && parseFloat(originalProduct.discountPrice) > 0 
        ? originalProduct.discountPrice 
        : originalProduct.price;

      resolvedItems.push({
        productId: originalProduct.id,
        sellerId: originalProduct.sellerId,
        quantity: remainingQuantity,
        price: finalPrice,
        productName: originalProduct.productName
      });
      remainingQuantity = 0;
    } else {
      // Step 1: Partially fulfill from the original seller if possible
      if (originalProduct.stock > 0) {
        const partialPrice = originalProduct.discountPrice && parseFloat(originalProduct.discountPrice) > 0 
          ? originalProduct.discountPrice 
          : originalProduct.price;

        resolvedItems.push({
          productId: originalProduct.id,
          sellerId: originalProduct.sellerId,
          quantity: originalProduct.stock,
          price: partialPrice,
          productName: originalProduct.productName
        });
        remainingQuantity -= originalProduct.stock;
      }

      // Step 2: Look for alternative sellers with the exact same product name
      const alternatives = await Product.findAll({
        where: {
          productName: originalProduct.productName,
          stock: { [Op.gt]: 0 },
          id: { [Op.ne]: originalProduct.id },
          status: 'active'
        },
        order: [['price', 'ASC']] // Try cheaper alternatives first
      });

      for (const alt of alternatives) {
        if (remainingQuantity <= 0) break;
        
        const qtyToTake = Math.min(alt.stock, remainingQuantity);
        const altPrice = alt.discountPrice && parseFloat(alt.discountPrice) > 0 
          ? alt.discountPrice 
          : alt.price;

        resolvedItems.push({
          productId: alt.id,
          sellerId: alt.sellerId,
          quantity: qtyToTake,
          price: altPrice,
          productName: alt.productName
        });
        remainingQuantity -= qtyToTake;
      }

      // Step 3: If still short, we must abort because total network stock is too low
      if (remainingQuantity > 0) {
        throw new ApiError(StatusCodes.BAD_REQUEST, `Only ${item.quantity - remainingQuantity} pieces of '${originalProduct.productName}' are available across all stores.`);
      }
    }
  }

  // Group resolved items by sellerId to create multiple local orders
  const itemsBySeller = resolvedItems.reduce((acc, item) => {
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
    let isFirstSeller = true;

    for (const sellerId in itemsBySeller) {
      const items = itemsBySeller[sellerId];
      const itemsTotal = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
      
      const appliedDeliveryFee = isFirstSeller ? deliveryFeePerSeller : 0;
      const appliedDiscount = isFirstSeller ? parseFloat(discountAmount || 0) : 0; // Apply total discount to the first order
      isFirstSeller = false;

      const orderTotal = itemsTotal + appliedDeliveryFee - appliedDiscount;
      const commissionAmount = itemsTotal * 0.20; // 20% admin commission

      // Create Order
      const order = await Order.create({
        userId,
        sellerId,
        groupId,
        totalAmount: orderTotal,
        discountAmount: appliedDiscount,
        couponId: couponId || null,
        deliveryFee: appliedDeliveryFee,
        commissionAmount,
        deliveryAddress,
        latitude,
        longitude,
        paymentMethod: paymentMethod || 'cod',
        paymentStatus: 'unpaid',
        orderNumber: `FB-${Date.now()}-${sellerId}`,
        location: latitude && longitude ? { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] } : null
      }, { transaction: t });

      // Create Order Items and Update Stock
      for (const item of items) {
        const product = await Product.findByPk(item.productId, { transaction: t });

        if (!product || product.stock < item.quantity) {
          throw new ApiError(StatusCodes.BAD_REQUEST, `Product ${product?.productName || 'unknown'} is out of stock`);
        }

        const newStock = product.stock - item.quantity;
        // Decrement stock
        await product.update({
          stock: newStock,
          status: newStock === 0 ? 'out-of-stock' : product.status
        }, { transaction: t });

        // Emit real-time stock update
        io.emit('stock_update', { productId: item.productId, newStock });

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

  let clientSecret = null;
  if (paymentMethod === 'stripe') {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const totalCents = Math.round(result.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0) * 100);
    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'inr',
      metadata: { groupId },
      automatic_payment_methods: { enabled: true }
    });
    clientSecret = intent.client_secret;
  }

  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: "Order(s) placed successfully",
    data: {
      confirmation: "Your order has been placed successfully!",
      groupId: groupId,
      clientSecret: clientSecret,
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
        id: order.id,
        orderNumber: gId,
        totalAmount: 0,
        status: order.status,
        createdAt: order.createdAt,
        deliveryAddress: order.deliveryAddress,
        deliveryOtp: order.deliveryOtp, // Share the OTP if any part has it (usually all same)
        paymentMethod: order.paymentMethod,
        Products: [],
        OrderSellers: []
      };
    }

    // Accumulate total
    groupedOrders[gId].totalAmount += parseFloat(order.totalAmount);

    // Collect products
    if (order.Products) {
        order.Products.forEach(prod => {
            groupedOrders[gId].Products.push({
                productName: prod.productName,
                productImage: prod.productImage,
                sellerName: order.Seller?.shop_name,
                OrderItem: {
                    quantity: prod.OrderItem.quantity,
                    price: prod.OrderItem.price
                }
            });
        });
    }

    // Add seller order info
    groupedOrders[gId].OrderSellers.push({
      sellerId: order.sellerId,
      amount: order.totalAmount,
      status: order.status,
      paymentMethod: order.paymentMethod,
      Seller: order.Seller
    });
  });

  // Convert map to array and format totals
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

export const getSellerOrders = catchAsync(async (req, res) => {
  const queryOptions = buildQuery(req.query, ['orderNumber', 'deliveryAddress']);
  
  const data = await Order.findAndCountAll({
    ...queryOptions,
    where: { 
      ...queryOptions.where,
      sellerId: req.user.id 
    },
    include: [
      { model: User, attributes: ['id', 'user_name', 'email', 'phone'] },
      { model: Product, through: { attributes: ['quantity', 'price'] } }
    ]
  });

  return successResponse({
    res,
    message: "Seller orders fetched",
    data: formatPaginatedResponse(data, req.query.page, req.query.limit)
  });
});

/**
 * @desc Get Orders for Delivery Partner (Assigned)
 */
export const getPartnerOrders = catchAsync(async (req, res) => {
  const partnerId = req.user.id;
  try {
    const orders = await Order.findAll({
      where: { deliveryPartnerId: partnerId },
      include: [
        { model: User, attributes: ['id', 'user_name', 'email', 'phone'] },
        { model: Seller, attributes: ['id', 'shop_name', 'phone', 'address'] },
        {
          model: Product,
          through: { attributes: ['quantity', 'price'] },
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    return successResponse({ res, data: orders });
  } catch (error) {
    console.error("Error in getPartnerOrders:", error);
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to fetch partner orders");
  }
});

/**
 * @desc Update Order Status (Strict Workflow)
 */
export const updateOrderStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const { role, user } = req;

  const order = await Order.findByPk(id);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  // Permission & Workflow Logic
  const canUpdate = (reqRole, orderStatus, targetStatus) => {
    // 1. SELLER WORKFLOW
    if (reqRole === 'seller' && order.sellerId === user.id) {
      if (orderStatus === 'pending' && targetStatus === 'preparing') return true;
      if (orderStatus === 'preparing' && targetStatus === 'awaiting-assignment') return true;
      if (orderStatus === 'ready-to-ship' && targetStatus === 'shipped') return true;
      if (targetStatus === 'cancelled' && orderStatus === 'pending') return true;
      return false;
    }

    // 2. ADMIN WORKFLOW (Global control)
    if (reqRole === 'admin') {
      // Admin handles assign/dispatch via separate endpoints, 
      // but can cancel or override status if needed.
      if (targetStatus === 'cancelled') return true;
      return true; // Admin has power
    }

    // 3. DELIVERY PARTNER WORKFLOW
    if (reqRole === 'delivery' && order.deliveryPartnerId === user.id) {
      if (orderStatus === 'assigned' && targetStatus === 'accepted-by-partner') return true;
      if (orderStatus === 'shipped' && targetStatus === 'out-for-delivery') return true;
      if (orderStatus === 'out-for-delivery' && targetStatus === 'arrived') return true;
      if (orderStatus === 'arrived' && targetStatus === 'delivered') {
        const { otp } = req.body;
        if (!otp) throw new ApiError(StatusCodes.BAD_REQUEST, "OTP is required for delivery");
        
        // Expiry & Value Check
        if (new Date() > new Date(order.otpExpiry)) {
          throw new ApiError(StatusCodes.BAD_REQUEST, "OTP has expired. Please resend.");
        }
        if (otp !== order.deliveryOtp) {
          throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid OTP code");
        }
        return true;
      }
      return false;
    }

    // 4. USER (Customer) - Can only cancel early
    if (reqRole === 'user' && order.userId === user.id) {
       if (targetStatus === 'cancelled' && ['pending', 'preparing'].includes(orderStatus)) return true;
       return false;
    }

    return false;
  };

  if (!canUpdate(role, order.status, status)) {
    throw new ApiError(StatusCodes.FORBIDDEN, `Invalid status transition from ${order.status} to ${status} for role ${role}`);
  }

  // Update logic
  let updateData = { status };
  
  if (status === 'arrived') {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    updateData.deliveryOtp = otp;
    updateData.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    updateData.otpVerified = false;
  }

  if (status === 'delivered') {
    updateData.paymentStatus = 'paid';
    updateData.otpVerified = true;
    updateData.status = 'completed'; // Auto-advance to completed
  }

  await order.update(updateData);

  // Emit real-time order update for tracking
  io.emit(`order_update_${order.id}`, { status: order.status, orderId: order.id });
  io.emit(`user_orders_${order.userId}`, { type: 'STATUS_UPDATE', orderId: order.id, status: order.status });

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

/**
 * @desc Resend Delivery OTP
 */
export const resendOtp = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { user, role } = req;

  const order = await Order.findByPk(id);
  if (!order) throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");

  // Check if current user is the delivery partner assigned to this order
  if (role !== 'delivery' || order.deliveryPartnerId !== user.id) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Only the assigned delivery partner can resend OTP");
  }

  if (order.status !== 'arrived') {
    throw new ApiError(StatusCodes.BAD_REQUEST, "OTP can only be resent when at customer location (arrived status)");
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await order.update({
    deliveryOtp: otp,
    otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
    otpVerified: false
  });

  // Trigger Notification (This sends the email)
  import('../../utils/notificationService.js').then(({ notifyOrderStatusChange }) => {
    // We pass a custom flag or just rely on status change notifying
    notifyOrderStatusChange(order);
  }).catch(err => console.error("Notification failed", err));

  return successResponse({
    res,
    message: "New OTP sent to customer",
    data: { otpExpiry: order.otpExpiry }
  });
});
