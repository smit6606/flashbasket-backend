import { Review, User, Product } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';

/**
 * @desc Add product review
 */
export const createReview = catchAsync(async (req, res) => {
  const { productId, rating, comment } = req.body;
  const userId = req.user.id;

  // Check if product exists
  const product = await Product.findByPk(productId);
  if (!product) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Product not found");
  }

  // Prevent duplicate reviews
  const existingReview = await Review.findOne({ where: { userId, productId } });
  if (existingReview) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "You have already reviewed this product");
  }

  const review = await Review.create({
    userId,
    productId,
    rating,
    comment
  });

  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: "Review added successfully",
    data: review
  });
});

/**
 * @desc Get all reviews for a product
 */
export const getProductReviews = catchAsync(async (req, res) => {
  const { productId } = req.params;

  const reviews = await Review.findAll({
    where: { productId },
    include: [{ model: User, attributes: ['user_name'] }],
    order: [['createdAt', 'DESC']]
  });

  return successResponse({
    res,
    message: "Product reviews fetched",
    data: reviews
  });
});
