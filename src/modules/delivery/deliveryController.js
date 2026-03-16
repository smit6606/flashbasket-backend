import { Order, User, Seller, Product, DeliveryPartner } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';
import { io } from "../../../server.js";
import { logOrderHistory } from '../order/orderController.js';

/**
 * @desc Get available orders for pickup in partner's city
 */
export const getAvailableOrders = catchAsync(async (req, res) => {
  const partner = await DeliveryPartner.findByPk(req.user.id);
  if (!partner) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Delivery partner profile not found");
  }

  const orders = await Order.findAll({
    where: { 
      status: 'awaiting-assignment', 
      deliveryPartnerId: null,
      city: partner.city
    },
    include: [
      { model: Seller, attributes: ['shop_name', 'address', 'latitude', 'longitude', 'phone'] },
      { model: User, attributes: ['user_name', 'phone', 'latitude', 'longitude'] }
    ],
    order: [['createdAt', 'DESC']]
  });

  return successResponse({
    res,
    message: "Available orders fetched",
    data: orders
  });
});

/**
 * @desc Accept order with concurrency protection
 */
export const acceptOrder = catchAsync(async (req, res) => {
  const { id } = req.params;
  const partnerId = req.user.id;

  // 1. Production-level atomic update to prevent race conditions
  const [updatedCount] = await Order.update({ 
    deliveryPartnerId: partnerId,
    status: 'accepted-by-partner',
    acceptedAt: new Date()
  }, {
    where: { 
      id: id, 
      deliveryPartnerId: null, // Critical: only update if no one else has it
      status: 'awaiting-assignment'
    }
  });

  if (updatedCount === 0) {
    // If update failed, either someone else got it or order ID is wrong
    const existingOrder = await Order.findByPk(id);
    if (!existingOrder) throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
    if (existingOrder.deliveryPartnerId) {
       throw new ApiError(StatusCodes.BAD_REQUEST, "Another driver accepted this order faster.");
    }
    throw new ApiError(StatusCodes.BAD_REQUEST, "Order is no longer available for acceptance.");
  }

  const order = await Order.findByPk(id, {
    include: [
      { model: Seller, attributes: ['shop_name', 'phone', 'address'] },
      { model: User, attributes: ['user_name', 'phone'] }
    ]
  });

  // 2. Real-time broadcast to all clients
  io.emit('order_accepted', { 
    orderId: id, 
    driverId: partnerId,
    driverName: req.user.name || 'A driver'
  });

  // 3. Status updates for tracking
  io.emit(`order_update_${id}`, { status: 'accepted-by-partner', orderId: id });
  io.emit(`user_orders_${order.userId}`, { type: 'STATUS_UPDATE', orderId: id, status: 'accepted-by-partner' });

  // 4. Log History
  await logOrderHistory(id, 'accepted-by-partner', 'Delivery partner accepted the order', 'delivery', partnerId);

  return successResponse({
    res,
    message: "Order accepted successfully",
    data: order
  });
});

/**
 * @desc Mark order as picked up
 */
export const pickupOrder = catchAsync(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findOne({
    where: { id, deliveryPartnerId: req.user.id }
  });

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found or not assigned to you");
  }

  await order.update({ status: 'out-for-delivery' });

  // Log History
  await logOrderHistory(id, 'out-for-delivery', 'Order picked up and on the way', 'delivery', req.user.id);

  // Real-time update to customer
  io.emit(`order_update_${order.id}`, { status: 'out-for-delivery', orderId: order.id });
  io.emit(`user_orders_${order.userId}`, { type: 'STATUS_UPDATE', orderId: order.id, status: 'out-for-delivery' });

  return successResponse({
    res,
    message: "Order marked as picked up",
    data: order
  });
});

/**
 * @desc Mark order as delivered
 */
export const completeDelivery = catchAsync(async (req, res) => {
  const { id } = req.params;

  const order = await Order.findOne({
    where: { id, deliveryPartnerId: req.user.id }
  });

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found or not assigned to you");
  }

  await order.update({ 
    status: 'delivered',
    paymentStatus: 'paid' // Assuming COD or successful completion
  });

  // Log History
  await logOrderHistory(id, 'delivered', 'Order delivered successfully', 'delivery', req.user.id);

  // Real-time update to customer
  io.emit(`order_update_${order.id}`, { status: 'delivered', orderId: order.id });
  io.emit(`user_orders_${order.userId}`, { type: 'STATUS_UPDATE', orderId: order.id, status: 'delivered' });

  return successResponse({
    res,
    message: "Order delivered successfully",
    data: order
  });
});

/**
 * @desc Get Partner's active/past deliveries
 */
export const getMyDeliveries = catchAsync(async (req, res) => {
  const orders = await Order.findAll({
    where: { deliveryPartnerId: req.user.id },
    include: [{ model: Product, through: { attributes: ['quantity', 'price'] } }],
    order: [['createdAt', 'DESC']]
  });

  return successResponse({
    res,
    message: "Your deliveries fetched",
    data: orders
  });
});
