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
  const { lat, lng, distance = 5, pincode, query } = req.query;

  const sellers = await sellerService.findNearbySellers({
    lat: lat ? parseFloat(lat) : null,
    lng: lng ? parseFloat(lng) : null,
    distance: parseFloat(distance),
    pincode,
    query
  });

  return successResponse({
    res,
    message: `Found ${sellers.length} sellers`,
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
 * @desc Get single seller by ID
 */
export const getSellerById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const seller = await sellerService.getSellerById(id);
  
  if (!seller) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Seller not found");
  }

  return successResponse({
    res,
    message: "Seller fetched successfully",
    data: seller
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
 */
export const getSellerDashboardStats = catchAsync(async (req, res) => {
  const sellerId = req.user.id;

  const [orderStats, productCount] = await Promise.all([
    Order.findOne({
      where: { sellerId },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalOrders'],
        [sequelize.fn('SUM', sequelize.col('totalAmount')), 'totalRevenue'],
      ],
      raw: true
    }),
    Product.count({ where: { sellerId } })
  ]);

  // Top Selling Products
  const topProducts = await sequelize.query(`
    SELECT p.productName, SUM(oi.quantity) as totalSold, SUM(oi.quantity * oi.price) as revenue
    FROM Products p
    JOIN OrderItems oi ON p.id = oi.ProductId
    JOIN Orders o ON oi.OrderId = o.id
    WHERE o.sellerId = ${sellerId} AND o.status = 'Completed'
    GROUP BY p.id
    ORDER BY totalSold DESC
    LIMIT 5
  `, { type: sequelize.QueryTypes.SELECT });

  // Least Selling Products
  const leastProducts = await sequelize.query(`
    SELECT p.productName, SUM(COALESCE(oi.quantity, 0)) as totalSold
    FROM Products p
    LEFT JOIN OrderItems oi ON p.id = oi.ProductId
    LEFT JOIN Orders o ON oi.OrderId = o.id AND o.status = 'Completed'
    WHERE p.sellerId = ${sellerId}
    GROUP BY p.id
    ORDER BY totalSold ASC
    LIMIT 5
  `, { type: sequelize.QueryTypes.SELECT });

  // Monthly Sales Revenue (last 6 months)
  const monthlySales = await sequelize.query(`
    SELECT 
      DATE_FORMAT(createdAt, '%b') as month,
      SUM(totalAmount) as revenue
    FROM Orders
    WHERE sellerId = ${sellerId} AND status = 'Completed'
      AND createdAt >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
    GROUP BY month
    ORDER BY MIN(createdAt) ASC
  `, { type: sequelize.QueryTypes.SELECT });

  const activeOrders = await Order.count({
    where: {
      sellerId,
      status: ['Pending', 'Preparing', 'Out-for-Delivery', 'Shipped', 'Arrived']
    }
  });

  const seller = await Seller.findByPk(sellerId, { attributes: ['status'] });

  return successResponse({
    res,
    message: "Seller analytics fetched",
    data: {
      stats: {
        totalOrders: parseInt(orderStats?.totalOrders || 0),
        totalRevenue: parseFloat(orderStats?.totalRevenue || 0),
        totalProducts: productCount,
        activeOrders,
        sellerStatus: seller.status
      },
      charts: {
        topProducts,
        leastProducts,
        monthlySales
      }
    }
  });
});
