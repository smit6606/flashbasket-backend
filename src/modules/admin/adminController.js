import authService from '../auth/authService.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';
import { User, Seller, DeliveryPartner, Order, sequelize } from '../../models/index.js';

/**
 * @desc Get all registered users
 */
export const getAllUsers = catchAsync(async (req, res) => {
  const users = await authService.findAllUsers('user');
  return successResponse({
    res,
    message: "Users fetched successfully",
    data: users
  });
});

/**
 * @desc Get all registered sellers
 */
export const getAllSellers = catchAsync(async (req, res) => {
  const sellers = await authService.findAllUsers('seller');
  return successResponse({
    res,
    message: "Sellers fetched successfully",
    data: sellers
  });
});

/**
 * @desc Get all delivery partners
 */
export const getAllPartners = catchAsync(async (req, res) => {
  const partners = await authService.findAllUsers('delivery');
  return successResponse({
    res,
    message: "Delivery partners fetched successfully",
    data: partners
  });
});

/**
 * @desc Manage Seller Status (Approve/Suspend)
 */
export const updateSellerStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // e.g., 'active', 'suspended'

  const seller = await Seller.findByPk(id);
  if (!seller) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Seller not found");
  }

  await seller.update({ status });

  return successResponse({
    res,
    message: `Seller status updated to ${status}`,
    data: seller
  });
});

/**
 * @desc Admin Dashboard Stats
 */
export const getAdminStats = catchAsync(async (req, res) => {
  const [userCount, sellerCount, partnerCount, orderStats] = await Promise.all([
    User.count(),
    Seller.count(),
    DeliveryPartner.count(),
    Order.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalOrders'],
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalSales'],
        [sequelize.fn('SUM', sequelize.col('commissionAmount')), 'totalCommission']
      ],
      raw: true
    })
  ]);

  return successResponse({
    res,
    message: "Admin stats fetched",
    data: {
      totalUsers: userCount,
      totalSellers: sellerCount,
      totalPartners: partnerCount,
      revenue: {
        totalSales: parseFloat(orderStats?.totalSales || 0),
        totalOrders: parseInt(orderStats?.totalOrders || 0),
        totalCommission: parseFloat(orderStats?.totalCommission || 0)
      }
    }
  });
});

/**
 * @desc Get Admin Commission Analytics
 * GET /api/admin/commission
 */
export const getAdminCommissionStats = catchAsync(async (req, res) => {
  const stats = await Order.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
      [sequelize.fn('SUM', sequelize.col('commissionAmount')), 'dailyCommission'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'orderCount']
    ],
    group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
    order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'DESC']],
    limit: 30
  });

  return successResponse({
    res,
    message: "Commission stats fetched",
    data: stats
  });
});

/**
 * @desc Get all orders (Admin)
 * GET /api/admin/orders
 */
export const getAllOrders = catchAsync(async (req, res) => {
  const orders = await Order.findAll({
    include: [
      { model: User, attributes: ['id', 'user_name', 'email'] },
      { model: Seller, attributes: ['id', 'shop_name'] },
      { model: DeliveryPartner, as: 'DeliveryPartner', attributes: ['id', 'user_name', 'name'] }
    ],
    order: [['createdAt', 'DESC']]
  });

  return successResponse({
    res,
    message: "All orders fetched",
    data: orders
  });
});

/**
 * @desc Assign Delivery Partner to Order
 * PUT /api/admin/assign-delivery
 */
export const assignDeliveryPartner = catchAsync(async (req, res) => {
  const { orderId, partnerId } = req.body;

  const order = await Order.findByPk(orderId);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  const partner = await DeliveryPartner.findByPk(partnerId);
  if (!partner || !partner.isAvailable) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Delivery partner not found or unavailable");
  }

  await order.update({
    deliveryPartnerId: partnerId,
    status: 'assigned' 
  });

  // Optionally mark partner as busy
  // await partner.update({ isAvailable: false });

  return successResponse({
    res,
    message: "Delivery partner assigned successfully",
    data: order
  });
});

/**
 * @desc Admin Sends Order to Seller (Dispatches)
 * PUT /api/admin/dispatch-order/:orderId
 */
export const dispatchOrderToSeller = catchAsync(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findByPk(orderId);
  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
  }

  if (order.status !== 'accepted-by-partner') {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Delivery partner must accept the order before dispatching.");
  }

  await order.update({ status: 'ready-to-ship' });

  // Trigger Notification
  import('../../utils/notificationService.js').then(({ notifyOrderStatusChange }) => {
    notifyOrderStatusChange(order);
  }).catch(err => console.error("Notification failed", err));

  return successResponse({
    res,
    message: "Order dispatched back to seller for shipping!",
    data: order
  });
});
