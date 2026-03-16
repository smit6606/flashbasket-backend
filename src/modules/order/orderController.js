import { Order, OrderItem, Cart, CartItem, Product, Seller, DeliveryPartner, User, OrderLog, sequelize } from '../../models/index.js';
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
 * @desc Generate professional Order ID
 */
const generateOrderNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `ORD-${year}-${random}`;
};

/**
 * @desc Helper to log order status changes
 */
export const logOrderHistory = async (orderId, status, message, role = 'system', userId = null) => {
    try {
        await OrderLog.create({ orderId, status, message, role, userId });
    } catch (err) {
        console.error("Order logging failed:", err);
    }
};

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
      const finalPrice = item.priceAtPurchase || originalProduct.finalPrice || originalProduct.price;

      resolvedItems.push({
        productId: originalProduct.id,
        sellerId: originalProduct.sellerId,
        quantity: remainingQuantity,
        price: finalPrice,
        discountAmount: item.discountAmount || 0,
        productName: originalProduct.productName
      });
      remainingQuantity = 0;
    } else {
      // Step 1: Partially fulfill from the original seller if possible
      if (originalProduct.stock > 0) {
        const partialPrice = item.priceAtPurchase || originalProduct.finalPrice || originalProduct.price;

        resolvedItems.push({
          productId: originalProduct.id,
          sellerId: originalProduct.sellerId,
          quantity: originalProduct.stock,
          price: partialPrice,
          discountAmount: item.discountAmount || 0,
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
        const altPrice = alt.finalPrice || alt.price;

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
  
  // Calculate Grand Total for Fee Logic
  const totalItemAmount = resolvedItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  
  // Zepto Logic
  let globalHandlingFee = 4;
  let globalDeliveryFee = totalItemAmount >= 200 ? 0 : 20;

  // Promotional Offer Logic:
  let globalPromoDiscount = totalItemAmount >= 1000 ? 50 : 0;

  // Create a unique group ID for this checkout session
  const groupId = `GRP-${Date.now()}-${userId}`;
  const orderNumber = generateOrderNumber(); // Unified ID for entire checkout session

      // 3. Create Orders (Transactionally)
      const result = await sequelize.transaction(async (t) => {
        let isFirstSeller = true;

        for (const sellerId in itemsBySeller) {
          const items = itemsBySeller[sellerId];
          const itemsSubtotal = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
          const itemsDiscount = items.reduce((sum, item) => sum + (parseFloat(item.discountAmount) * item.quantity), 0);
          
          // Apply fees and initial discount to the first seller's order for simplicity
          const appliedDeliveryFee = isFirstSeller ? globalDeliveryFee : 0;
          const appliedHandlingFee = isFirstSeller ? globalHandlingFee : 0;
          const appliedCouponDiscount = isFirstSeller ? parseFloat(discountAmount || 0) : 0; 
          const appliedPromoDiscount = isFirstSeller ? globalPromoDiscount : 0;
          
          isFirstSeller = false;

          const orderTotal = itemsSubtotal + appliedDeliveryFee + appliedHandlingFee - appliedCouponDiscount - appliedPromoDiscount;
          const commissionAmount = itemsSubtotal * 0.20; // 20% admin commission

          // Create Order
          let orderCity = req.body.city || null;
          
          // Attempt to extract city from deliveryAddress if it's an object/JSON
          if (!orderCity && deliveryAddress) {
              try {
                  if (typeof deliveryAddress === 'string' && (deliveryAddress.startsWith('{') || deliveryAddress.startsWith('['))) {
                      const parsed = JSON.parse(deliveryAddress);
                      orderCity = parsed.city || null;
                  } else if (typeof deliveryAddress === 'object') {
                      orderCity = deliveryAddress.city || null;
                  }
              } catch (e) {
                  console.warn("Failed to parse deliveryAddress for city extraction");
              }
          }

          const order = await Order.create({
        userId,
        sellerId,
        groupId,
        totalAmount: orderTotal,
        discountAmount: itemsDiscount + appliedCouponDiscount + appliedPromoDiscount, // Combined item discount + coupon + promo
        couponId: couponId || null,
        deliveryFee: appliedDeliveryFee,
        handlingFee: appliedHandlingFee,
        commissionAmount,
        deliveryAddress,
        city: orderCity,
        latitude,
        longitude,
        paymentMethod: paymentMethod || 'cod',
        paymentStatus: 'unpaid',
        orderNumber: orderNumber,
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

      // 3.1 Log Initial Status
      await OrderLog.create({
        orderId: order.id,
        status: 'pending',
        message: 'Order placed successfully',
        role: 'user',
        userId: userId
      }, { transaction: t });

      createdOrders.push(order);
      
      // Emit real-time notification to the seller
      io.emit(`seller_notifications_${sellerId}`, { 
          type: 'NEW_ORDER', 
          orderId: order.id, 
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount 
      });
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
        orderNumber: order.orderNumber,
        groupId: gId,
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

  const orders = await Order.findAll({
    where: { orderNumber },
    include: [
      { model: Product, through: { attributes: ['quantity', 'price'] } },
      { model: Seller, attributes: ['id', 'shop_name', 'address', 'phone'] },
      {
        model: DeliveryPartner,
        as: 'DeliveryPartner',
        attributes: ['id', 'name', 'phone', 'vehicleType', 'vehicleNumber', 'latitude', 'longitude']
      }
    ]
  });

  if (!orders || orders.length === 0) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  // Multi-seller aggregation logic
  const aggregatedOrder = {
    orderNumber: orders[0].orderNumber,
    groupId: orders[0].groupId,
    status: orders[0].status, // Simplification: use first order status
    createdAt: orders[0].createdAt,
    deliveryAddress: orders[0].deliveryAddress,
    totalAmount: orders.reduce((sum, o) => sum + parseFloat(o.totalAmount), 0).toFixed(2),
    subOrders: orders.map(o => ({
        id: o.id,
        seller: o.Seller,
        status: o.status,
        total: o.totalAmount,
        products: o.Products,
        deliveryPartner: o.DeliveryPartner
    }))
  };

  // Basic security: only owner can track (unless admin/seller/partner)
  if (req.user.role === 'user' && orders[0].userId !== req.user.id) {
    throw new ApiError(StatusCodes.FORBIDDEN, "Not authorized to track this order");
  }

  return successResponse({
    res,
    message: "Tracking details fetched",
    data: aggregatedOrder
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
      { model: Product, through: { attributes: ['quantity', 'price'] } },
      { model: DeliveryPartner, as: 'DeliveryPartner', attributes: ['id', 'name', 'phone', 'profileImage'] }
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
 * @desc Get Order Logs (Timeline)
 */
export const getOrderLogs = catchAsync(async (req, res) => {
  const { id } = req.params;
  const logs = await OrderLog.findAll({
    where: { orderId: id },
    order: [['createdAt', 'ASC']]
  });
  return successResponse({ res, data: logs });
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
  
  // Log History
  await logOrderHistory(
    order.id, 
    status, 
    `Order status updated to ${status.replace(/-/g, ' ')}`, 
    role, 
    user.id
  );

  // Emit real-time order update for tracking
  io.emit(`order_update_${order.id}`, { status: order.status, orderId: order.id });
  io.emit(`user_orders_${order.userId}`, { type: 'STATUS_UPDATE', orderId: order.id, status: order.status });
  
  if (order.status === 'awaiting-assignment') {
    io.emit('new_order_broadcast', { city: order.city, orderId: order.id });
  }

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
