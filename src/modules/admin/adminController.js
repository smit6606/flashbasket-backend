import authService from '../auth/authService.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';
import { User, Seller, DeliveryPartner, Order, sequelize } from '../../models/index.js';
import { Op } from 'sequelize';
import { buildQuery, formatPaginatedResponse } from '../../utils/queryHelper.js';

/**
 * @desc Get all registered users
 */
export const getAllUsers = catchAsync(async (req, res) => {
  const queryOptions = buildQuery(req.query, ['user_name', 'email', 'phone']);
  
  const data = await User.findAndCountAll({
    ...queryOptions,
    attributes: { exclude: ['password'] }
  });

  return successResponse({
    res,
    message: "Users fetched successfully",
    data: formatPaginatedResponse(data, req.query.page, req.query.limit)
  });
});

/**
 * @desc Get all registered sellers
 */
export const getAllSellers = catchAsync(async (req, res) => {
  const queryOptions = buildQuery(req.query, ['shop_name', 'email', 'owner_name']);
  
  const data = await Seller.findAndCountAll({
    ...queryOptions,
    attributes: { exclude: ['password'] }
  });

  return successResponse({
    res,
    message: "Sellers fetched successfully",
    data: formatPaginatedResponse(data, req.query.page, req.query.limit)
  });
});

/**
 * @desc Get all delivery partners
 */
export const getAllPartners = catchAsync(async (req, res) => {
  const queryOptions = buildQuery(req.query, ['name', 'email', 'phone']);
  
  const data = await DeliveryPartner.findAndCountAll({
    ...queryOptions,
    attributes: { exclude: ['password'] }
  });

  return successResponse({
    res,
    message: "Delivery partners fetched successfully",
    data: formatPaginatedResponse(data, req.query.page, req.query.limit)
  });
});

/**
 * @desc Manage Seller Status (Approve/Suspend)
 */
export const updateSellerStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'Active' or 'Suspended'

  const validStatuses = ['Pending', 'Active', 'Suspended', 'Rejected'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

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
  const { search } = req.query;
  const queryOptions = buildQuery(req.query, ['orderNumber', 'deliveryAddress']);
  
  if (search) {
    queryOptions.where[Op.or] = [
        { orderNumber: { [Op.substring]: search } },
        { '$User.user_name$': { [Op.substring]: search } },
        { '$Seller.shop_name$': { [Op.substring]: search } },
        { '$DeliveryPartner.name$': { [Op.substring]: search } }
    ];
  }

  const data = await Order.findAndCountAll({
    ...queryOptions,
    include: [
      { model: User, attributes: ['id', 'user_name', 'email', 'profileImage'] },
      { model: Seller, attributes: ['id', 'shop_name', 'profileImage'] },
      { model: DeliveryPartner, as: 'DeliveryPartner', attributes: ['id', 'user_name', 'name', 'profileImage', 'phone'] }
    ]
  });

  return successResponse({
    res,
    message: "All orders fetched",
    data: formatPaginatedResponse(data, req.query.page, req.query.limit)
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
    status: 'Assigned' 
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

  if (order.status !== 'Accepted-By-Partner') {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Delivery partner must accept the order before dispatching.");
  }

  await order.update({ status: 'Ready-to-Ship' });

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

/**
 * @desc Get Unified Users (Admin, Seller, Delivery, Customer)
 * GET /api/admin/unified-users
 */
export const getUnifiedUsers = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, search = '', role = 'all', status = 'all', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  const offset = (page - 1) * limit;

  let searchCondition = '';
  if (search) {
    searchCondition = `AND (name LIKE :search OR email LIKE :search OR phone LIKE :search)`;
  }
  
  let roleCondition = '';
  if (role !== 'all') {
    roleCondition = `AND role = :role`;
  }

  let statusCondition = '';
  if (status !== 'all') {
    statusCondition = `AND status = :status`;
  }

  const queryParams = { 
    replacements: { 
      limit: parseInt(limit), 
      offset: parseInt(offset), 
      search: `%${search}%`,
      role,
      status
    }, 
    type: sequelize.QueryTypes.SELECT 
  };

  const baseQuery = `
    SELECT id, name, email, phone, 'customer' AS role, status, profileImage, createdAt FROM Users WHERE 1=1 ${searchCondition}
    UNION ALL
    SELECT id, shop_name AS name, email, phone, 'seller' AS role, status, profileImage, createdAt FROM Sellers WHERE 1=1 ${searchCondition}
    UNION ALL
    SELECT id, name, email, phone, 'delivery' AS role, status, profileImage, createdAt FROM DeliveryPartners WHERE 1=1 ${searchCondition}
    UNION ALL
    SELECT id, name, email, phone, role as role, 'active' as status, profileImage, createdAt FROM Admins WHERE 1=1 ${searchCondition}
  `;

  const filteredQuery = `
    SELECT * FROM (${baseQuery}) as combined
    WHERE 1=1 ${roleCondition} ${statusCondition}
  `;

  // Prevent SQL injection by strictly matching allowed sortBy fields
  const allowedSortFields = ['id', 'name', 'email', 'phone', 'role', 'status', 'createdAt'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const finalQuery = `
    ${filteredQuery}
    ORDER BY ${safeSortBy} ${safeSortOrder}
    LIMIT :limit OFFSET :offset
  `;

  const countQuery = `
    SELECT COUNT(*) as total FROM (${filteredQuery}) as combinedCount
  `;

  const totalResult = await sequelize.query(countQuery, { replacements: queryParams.replacements, type: sequelize.QueryTypes.SELECT });
  const items = await sequelize.query(finalQuery, queryParams);

  return successResponse({
    res,
    message: "Unified users fetched successfully",
    data: {
      items,
      totalItems: totalResult[0].total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalResult[0].total / limit)
    }
  });
});

/**
 * @desc Manage Any User Status (Approve/Suspend/Block)
 * PATCH /api/admin/unified-users/:role/:id/status
 */
export const updateUnifiedUserStatus = catchAsync(async (req, res) => {
  const { role, id } = req.params;
  const { status } = req.body; 

  const getModelByRole = (roleStr) => {
    switch (roleStr) {
      case 'customer': return User;
      case 'seller': return Seller;
      case 'delivery': return DeliveryPartner;
      case 'admin': return null; // Prevent disabling other admins dynamically for safety
      default: return null;
    }
  };

  const Model = getModelByRole(role);
  if (!Model) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid role or operation not allowed");
  }

  const record = await Model.findByPk(id);
  if (!record) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  let finalStatus = status;
  if (status) {
    const s = status.toLowerCase();
    if (s === 'active') finalStatus = 'Active';
    else if (s === 'pending') finalStatus = 'Pending';
    else if (s === 'suspended') finalStatus = 'Suspended';
    else if (s === 'rejected') finalStatus = 'Rejected';
    else if (s === 'restricted') finalStatus = 'Restricted';
    else if (s === 'blocked') finalStatus = 'Blocked';
  }

  await record.update({ status: finalStatus });

  return successResponse({
    res,
    message: `${role} status updated to ${finalStatus}`,
    data: record
  });
});
