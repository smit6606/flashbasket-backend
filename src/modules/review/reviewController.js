import { Review, Product, Seller, Order, User, sequelize } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';

/**
 * @desc Create or Update a review for a product/seller
 */
export const createReview = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { productId, sellerId, rating, comment } = req.body;

  // Check if review already exists
  let review = await Review.findOne({
    where: { userId, productId }
  });

  if (review) {
    // Update existing review
    review.rating = rating;
    review.comment = comment || review.comment;
    await review.save();
  } else {
    // Create new review
    review = await Review.create({
      userId,
      productId,
      sellerId,
      rating,
      comment: comment || "Rated via FlashBasket"
    });
  }

  // Update Product's average rating and total count for faster fetching
  const stats = await Review.findAll({
    where: { productId },
    attributes: [
      [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalRatings']
    ],
    raw: true
  });

  const avgRating = stats[0].avgRating || 0;
  // We can optionally store these in the Product table for performance
  await Product.update(
    { rating: parseFloat(avgRating).toFixed(1) },
    { where: { id: productId } }
  );

  return successResponse({
    res,
    statusCode: StatusCodes.OK,
    message: "Review processed successfully",
    data: { ...review.toJSON(), avgRating: parseFloat(avgRating).toFixed(1) }
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
