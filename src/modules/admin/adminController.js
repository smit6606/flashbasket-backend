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
      orders: orderStats
    }
  });
});
