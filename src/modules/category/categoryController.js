import { Category, SubCategory } from '../../models/index.js';
import { MSG } from '../../utils/message.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
// import ApiError from '../../utils/ApiError.js'; // Use if needed

/**
 * @desc Create Category (Admin Only)
 */
export const createCategory = catchAsync(async (req, res) => {
  const { name, icon } = req.body;
  const category = await Category.create({ name, icon });

  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: MSG.CATEGORY.CREATED,
    data: category
  });
});

/**
 * @desc Get All Categories
 */
export const getCategories = catchAsync(async (req, res) => {
  const categories = await Category.findAll({
    include: [{ model: SubCategory }]
  });

  return successResponse({
    res,
    message: MSG.CATEGORY.FETCHED,
    data: categories
  });
});

/**
 * @desc Create SubCategory (Admin Only)
 */
export const createSubCategory = catchAsync(async (req, res) => {
  const { name, categoryId } = req.body;
  const subCategory = await SubCategory.create({ name, categoryId });

  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: MSG.CATEGORY.SUBCATEGORY_CREATED,
    data: subCategory
  });
});
