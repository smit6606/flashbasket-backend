import { Review, Product, Seller, Order, sequelize } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';

/**
 * @desc Create a review for a product/seller
 */
export const createReview = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { productId, sellerId, rating, comment } = req.body;

  // Check if user has ordered this product/seller (optional but common)
  // For now, allow simple review creation

  const review = await Review.create({
    userId,
    productId,
    sellerId,
    rating,
    comment
  });

  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: "Review submitted successfully",
    data: review
  });
});

/**
 * @desc Get reviews for a product
 */
export const getProductReviews = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const reviews = await Review.findAll({
    where: { productId },
    include: [{ model: User, attributes: ['id', 'name'] }]
  });

  return successResponse({
    res,
    message: "Product reviews fetched",
    data: reviews
  });
});
