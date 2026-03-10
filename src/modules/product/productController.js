import { Product, Category, SubCategory, Seller, sequelize } from '../../models/index.js';
import { MSG } from '../../utils/message.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import { Op } from 'sequelize';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';

/**
 * @desc Create Product (Sellers Only)
 */
export const createProduct = catchAsync(async (req, res) => {
  if (req.role !== 'seller') {
    throw new ApiError(StatusCodes.FORBIDDEN, MSG.PRODUCT.SELLER_ONLY);
  }

  const product = await Product.create({
    ...req.body,
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
  const { categoryId, minPrice, maxPrice, rating, lat, lng, radius } = req.query;
  const where = {};

  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price[Op.gte] = minPrice;
    if (maxPrice) where.price[Op.lte] = maxPrice;
  }

  if (categoryId) where.categoryId = categoryId;
  if (rating) where.rating = { [Op.gte]: rating };

  const include = [
    { model: Category, attributes: ['name'] },
    { model: SubCategory, attributes: ['name'] },
    { 
      model: Seller, 
      attributes: ['shop_name', 'location', 'latitude', 'longitude'],
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

  const products = await Product.findAll({ where, include });

  return successResponse({
    res,
    message: MSG.PRODUCT.FETCHED_ALL,
    data: products
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
      { model: SubCategory, attributes: ['name'] }
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
  const product = await Product.findOne({
    where: { id, sellerId: req.user.id }
  });

  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, MSG.PRODUCT.NOT_FOUND);
  }

  await product.update(req.body);

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
  const product = await Product.findOne({
    where: { id, sellerId: req.user.id }
  });

  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, MSG.PRODUCT.NOT_FOUND);
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
  const products = await Product.findAll({
    where: {
      [Op.or]: [
        { productName: { [Op.substring]: q } },
        { description: { [Op.substring]: q } }
      ]
    },
    include: [
      { model: Category, attributes: ['name'] },
      { model: SubCategory, attributes: ['name'] }
    ]
  });

  return successResponse({
    res,
    message: `${MSG.SERVER.ACTION_SUCCESS} Search results for "${q}"`,
    data: products
  });
});

export const getSellerProducts = catchAsync(async (req, res) => {
  const products = await Product.findAll({
    where: { sellerId: req.user.id },
    include: [
      { model: Category, attributes: ['name'] },
      { model: SubCategory, attributes: ['name'] }
    ]
  });

  return successResponse({
    res,
    message: MSG.PRODUCT.FETCHED_ALL,
    data: products
  });
});

export const getProductsByCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const products = await Product.findAll({
    where: { categoryId: id },
    include: [
      { model: Category, attributes: ['name'] },
      { model: SubCategory, attributes: ['name'] }
    ]
  });

  return successResponse({
    res,
    message: MSG.PRODUCT.FETCHED_ALL,
    data: products
  });
});
