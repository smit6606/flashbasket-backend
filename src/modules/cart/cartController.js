import cartService from './cartService.js';
import { successResponse } from '../../utils/responseFormat.js';
import { MSG } from '../../utils/message.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';

/**
 * @desc Add item to cart
 */
export const addToCart = catchAsync(async (req, res) => {
  const { productId, sellerId, quantity, price } = req.body;
  const userId = req.user.id;

  const item = await cartService.addToCart(userId, productId, sellerId, quantity, price);

  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: MSG.CART.ADDED,
    data: item
  });
});

/**
 * @desc Get user's cart
 */
export const getCart = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const cart = await cartService.getCart(userId);

  if (!cart) {
    return successResponse({
      res,
      message: MSG.CART.EMPTY,
      data: { items: [], subtotal: 0 }
    });
  }

  return successResponse({
    res,
    message: MSG.CART.FETCHED,
    data: cart
  });
});

/**
 * @desc Update cart item quantity
 */
export const updateCart = catchAsync(async (req, res) => {
  const { cartItemId, quantity } = req.body;
  const userId = req.user.id;

  const updated = await cartService.updateQuantity(userId, cartItemId, quantity);

  if (!updated) {
    throw new ApiError(StatusCodes.NOT_FOUND, MSG.CART.NOT_FOUND);
  }

  return successResponse({
    res,
    message: MSG.CART.UPDATED,
    data: updated
  });
});

/**
 * @desc Remove item from cart
 */
export const removeFromCart = catchAsync(async (req, res) => {
  const { cartItemId } = req.body;
  const userId = req.user.id;

  const removed = await cartService.removeFromCart(userId, cartItemId);

  if (!removed) {
    throw new ApiError(StatusCodes.NOT_FOUND, MSG.CART.NOT_FOUND);
  }

  return successResponse({
    res,
    message: MSG.CART.REMOVED
  });
});
