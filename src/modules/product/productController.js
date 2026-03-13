import { Product, Category, SubCategory, Seller, sequelize } from '../../models/index.js';
import { MSG } from '../../utils/message.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import { Op } from 'sequelize';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';
import { buildQuery, formatPaginatedResponse } from '../../utils/queryHelper.js';

import { uploadToCloudinary, uploadMultipleToCloudinary } from '../../utils/cloudinary.js';

/**
 * @desc Create Product (Sellers Only)
 */
export const createProduct = catchAsync(async (req, res) => {
  if (req.role !== 'seller') {
    throw new ApiError(StatusCodes.FORBIDDEN, MSG.PRODUCT.SELLER_ONLY);
  }

  // Handle uploaded files to Cloudinary
  let imageUrls = [];
  if (req.files && req.files.length > 0) {
    imageUrls = await uploadMultipleToCloudinary(req.files.map(f => f.buffer));
  }

  const product = await Product.create({
    ...req.body,
    images: imageUrls.length ? imageUrls : req.body.images,
    sellerId: req.user.id
  });

  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: MSG.PRODUCT.CREATED,
    data: product
  });
});

/**
 * @desc Get All Products (Public) with Filtering
 */
export const getAllProducts = catchAsync(async (req, res) => {
  const { minPrice, maxPrice, lat, lng, radius } = req.query;
  
  // Use buildQuery for standard fields
  const queryOptions = buildQuery(req.query, ['productName', 'description']);
  const where = queryOptions.where;
  where.status = 'active';

  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price[Op.gte] = minPrice;
    if (maxPrice) where.price[Op.lte] = maxPrice;
  }

  const include = [
    { model: Category, attributes: ['name'] },
    { model: SubCategory, attributes: ['name'] },
    {
      model: Seller,
      attributes: ['id', 'shop_name', 'location', 'latitude', 'longitude'],
      where: lat && lng ? sequelize.where(
        sequelize.fn(
          'ST_Distance_Sphere',
          sequelize.fn('ST_GeomFromText', `POINT(${lng} ${lat})`),
          sequelize.col('Seller.location')
        ),
        { [Op.lte]: (radius || 5) * 1000 }
      ) : undefined,
      required: !!(lat && lng)
    }
  ];

  // If geolocation sorting is requested (and lat/lng provided), override order
  if (lat && lng) {
    queryOptions.order = [[
      sequelize.fn(
        'ST_Distance_Sphere',
        sequelize.fn('ST_GeomFromText', `POINT(${lng} ${lat})`),
        sequelize.col('Seller.location')
      ),
      'ASC'
    ]];
  }

  const data = await Product.findAndCountAll({
    ...queryOptions,
    include
  });

  return successResponse({
    res,
    message: MSG.PRODUCT.FETCHED_ALL,
    data: formatPaginatedResponse(data, req.query.page, req.query.limit)
  });
});

/**
 * @desc Get Product By ID
 */
export const getProductById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findByPk(id, {
    include: [
      { model: Category, attributes: ['name'] },
      { model: SubCategory, attributes: ['name'] },
      { model: Seller, attributes: ['id', 'shop_name', 'address', 'latitude', 'longitude'] }
    ]
  });

  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, MSG.PRODUCT.NOT_FOUND);
  }

  return successResponse({
    res,
    message: MSG.PRODUCT.FETCHED,
    data: product
  });
});

/**
 * @desc Update Product
 */
export const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  
  const product = await Product.findByPk(id);

  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, MSG.PRODUCT.NOT_FOUND);
  }

  // Permission check
  const isAdmin = req.role && req.role.toLowerCase() === 'admin';
  const isOwner = product.sellerId === Number(req.user.id);

  if (!isAdmin && !isOwner) {
    throw new ApiError(StatusCodes.FORBIDDEN, "You do not have permission to update this product");
  }

  let finalImages = [];
  const { existingImages } = req.body;

  if (existingImages) {
    finalImages = Array.isArray(existingImages) ? existingImages : [existingImages];
  }

  if (req.files && req.files.length > 0) {
    const newImages = await uploadMultipleToCloudinary(req.files.map(f => f.buffer));
    finalImages = [...finalImages, ...newImages];
  } else if (!existingImages) {
    // Fallback to current images if no image-related data was sent (optional check depends on UI)
    finalImages = product.images;
  }

  await product.update({
    ...req.body,
    images: finalImages
  });

  return successResponse({
    res,
    message: MSG.PRODUCT.UPDATED,
    data: product
  });
});

/**
 * @desc Delete Product
 */
export const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  
  // Find product regardless of seller first to distinguish errors
  const product = await Product.findByPk(id);

  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, MSG.PRODUCT.NOT_FOUND);
  }

  // Check permission: Admin can delete anything, Seller can only delete their own
  const isAdmin = req.role && req.role.toLowerCase() === 'admin';
  const isOwner = product.sellerId === Number(req.user.id);

  if (!isAdmin && !isOwner) {
    throw new ApiError(StatusCodes.FORBIDDEN, "You do not have permission to delete this product");
  }

  await product.destroy();

  return successResponse({
    res,
    message: MSG.PRODUCT.DELETED
  });
});

// Other methods searchProducts, getSellerProducts etc. should follow the same pattern
export const searchProducts = catchAsync(async (req, res) => {
  const { q } = req.query;
  // Map 'q' to 'search' for buildQuery
  req.query.search = q;
  const queryOptions = buildQuery(req.query, ['productName', 'description']);
  queryOptions.where.status = 'active';

  const data = await Product.findAndCountAll({
    ...queryOptions,
    include: [
      { model: Category, attributes: ['name'] },
      { model: SubCategory, attributes: ['name'] },
      { model: Seller, attributes: ['id', 'shop_name', 'latitude', 'longitude'] }
    ]
  });

  return successResponse({
    res,
    message: `${MSG.SERVER.ACTION_SUCCESS} Search results for "${q}"`,
    data: formatPaginatedResponse(data, req.query.page, req.query.limit)
  });
});

/**
 * @desc Get All Products (Admin) with full search/filter
 */
export const getAdminProducts = catchAsync(async (req, res) => {
  const { search } = req.query;
  const queryOptions = buildQuery(req.query, ['productName', 'description']);

  // Ensure 'where' and 'Op.or' are ready for additional search conditions
  if (search) {
    if (!queryOptions.where[Op.or]) {
      queryOptions.where[Op.or] = [];
    }
    
    // Add association-based search (Seller shop_name)
    queryOptions.where[Op.or].push({
        '$Seller.shop_name$': { [Op.substring]: search }
    });
  }

  const data = await Product.findAndCountAll({
    ...queryOptions,
    distinct: true,
    subQuery: false, // Essential when filtering on included models in 'where'
    include: [
      { model: Category, attributes: ['name'] },
      { model: SubCategory, attributes: ['name'] },
      { model: Seller, attributes: ['id', 'shop_name', 'email'] }
    ]
  });

  return successResponse({
    res,
    message: "Admin products fetched",
    data: formatPaginatedResponse(data, req.query.page, req.query.limit)
  });
});

export const getSellerProducts = catchAsync(async (req, res) => {
  req.query.sellerId = req.user.id;
  const queryOptions = buildQuery(req.query, ['productName', 'description']);

  const data = await Product.findAndCountAll({
    ...queryOptions,
    include: [
      { model: Category, attributes: ['name'] },
      { model: SubCategory, attributes: ['name'] },
      { model: Seller, attributes: ['id', 'shop_name'] }
    ]
  });

  return successResponse({
    res,
    message: MSG.PRODUCT.FETCHED_ALL,
    data: formatPaginatedResponse(data, req.query.page, req.query.limit)
  });
});

export const getProductsByCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const products = await Product.findAll({
    where: { categoryId: id, status: 'active' },
    include: [
      { model: Category, attributes: ['name'] },
      { model: SubCategory, attributes: ['name'] },
      { model: Seller, attributes: ['id', 'shop_name', 'latitude', 'longitude'] }
    ]
  });

  return successResponse({
    res,
    message: MSG.PRODUCT.FETCHED_ALL,
    data: products
  });
});
