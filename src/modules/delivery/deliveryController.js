import { Order, User, Seller, Product } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';

/**
 * @desc Get available orders for pickup (unassigned or pending)
 */
export const getAvailableOrders = catchAsync(async (req, res) => {
  const orders = await Order.findAll({
    where: { 
      status: 'confirmed', // Orders ready to be picked up
      deliveryPartnerId: null 
    },
    include: [
      { model: Seller, attributes: ['shop_name', 'address', 'latitude', 'longitude'] },
      { model: User, attributes: ['user_name', 'latitude', 'longitude'] }
    ]
  });

  return successResponse({
    res,
    message: "Available orders fetched",
    data: orders
  });
});

/**
 * @desc Accept/Assign order to delivery partner
 */
export const acceptOrder = catchAsync(async (req, res) => {
  const { id } = req.params;
  const partnerId = req.user.id;

  const order = await Order.findByPk(id);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  if (order.deliveryPartnerId) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Order already assigned to someone else");
  }

  await order.update({ 
    deliveryPartnerId: partnerId,
    status: 'preparing' // Partner is on the way to pick up
  });

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
