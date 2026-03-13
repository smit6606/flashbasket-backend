import { Coupon } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';
import { Op } from 'sequelize';

export const validateCoupon = catchAsync(async (req, res) => {
  const { code, orderValue } = req.body;

  const coupon = await Coupon.findOne({
    where: {
      code,
      isActive: true,
      expiryDate: { [Op.gt]: new Date() }
    }
  });

  if (!coupon) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid or expired coupon code");
  }

  if (parseFloat(orderValue) < parseFloat(coupon.minOrderValue)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, `Minimum order value for this coupon is ₹${coupon.minOrderValue}`);
  }

  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = (parseFloat(orderValue) * parseFloat(coupon.discountValue)) / 100;
  } else {
    discount = parseFloat(coupon.discountValue);
  }

  return successResponse({
    res,
    message: "Coupon validated",
    data: {
      id: coupon.id,
      code: coupon.code,
      discountAmount: discount.toFixed(2),
      discountType: coupon.discountType,
      discountValue: coupon.discountValue
    }
  });
});

// Admin can create coupons
export const createCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.create(req.body);
  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: "Coupon created",
    data: coupon
  });
});
