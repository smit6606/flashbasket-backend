import sellerService from './sellerService.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';
import { Seller, Order, Product, sequelize } from '../../models/index.js';

/**
 * @desc Get nearby sellers
 */
export const getNearbySellers = catchAsync(async (req, res) => {
  const { lat, lng, distance = 5 } = req.query;

  if (!lat || !lng) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Latitude and Longitude are required");
  }

  const sellers = await sellerService.findNearbySellers(
    parseFloat(lat),
    parseFloat(lng),
    parseFloat(distance)
  );

  return successResponse({
    res,
    message: `Found ${sellers.length} sellers within ${distance}km`,
    data: sellers
  });
});

/**
 * @desc Get all sellers
 */
export const fetchAllSellers = catchAsync(async (req, res) => {
  const sellers = await sellerService.getAllSellers();
  return successResponse({
    res,
    message: "Sellers fetched successfully",
    data: sellers
  });
});

/**
 * @desc Update Seller Profile (Location, Shop Name, etc.)
 */
export const updateSellerProfile = catchAsync(async (req, res) => {
  const sellerId = req.user.id;
  const { shop_name, address, phone, latitude, longitude } = req.body;

  const seller = await Seller.findByPk(sellerId);
  if (!seller) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Seller not found");
  }

  const updateData = { shop_name, address, phone, latitude, longitude };

  if (latitude && longitude) {
    updateData.location = { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] };
  }

  await seller.update(updateData);

  return successResponse({
    res,
    message: "Seller profile updated successfully",
    data: seller
  });
});

/**
 * @desc Seller Dashboard Stats
 * GET /api/seller/dashboard
 */
export const getSellerDashboardStats = catchAsync(async (req, res) => {
  const sellerId = req.user.id;

  const [orderStats, productCount] = await Promise.all([
    Order.findOne({
      where: { sellerId },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalOrders'],
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalRevenue'],
        [sequelize.fn('SUM', sequelize.col('deliveryFee')), 'deliveryFees']
      ],
      raw: true
    }),
    Product.count({ where: { sellerId } })
  ]);

  // Calculate active orders
  const activeOrders = await Order.count({
    where: {
      sellerId,
      status: ['pending', 'confirmed', 'preparing', 'out-for-delivery']
    }
  });

  return successResponse({
    res,
    message: "Seller dashboard stats fetched",
    data: {
      stats: {
        totalOrders: parseInt(orderStats?.totalOrders || 0),
        totalRevenue: parseFloat(orderStats?.totalRevenue || 0),
        totalProducts: productCount,
        activeOrders
      }
    }
  });
});
