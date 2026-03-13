import { Category, SubCategory, Product, OrderItem, sequelize } from '../../models/index.js';
import { MSG } from '../../utils/message.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { buildQuery, formatPaginatedResponse } from '../../utils/queryHelper.js';

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
  const queryOptions = buildQuery(req.query, ['name']);
  
  const data = await Category.findAndCountAll({
    ...queryOptions,
    include: [{ model: SubCategory }]
  });

  return successResponse({
    res,
    message: MSG.CATEGORY.FETCHED,
    data: formatPaginatedResponse(data, req.query.page, req.query.limit)
  });
});

/**
 * @desc Get Single Category (with Subcategories)
 */
export const getCategoryById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const category = await Category.findByPk(id, {
    include: [{ model: SubCategory }]
  });

  if (!category) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
  }

  return successResponse({
    res,
    message: "Category details fetched",
    data: category
  });
});

/**
 * @desc Get All SubCategories
 */
export const getSubCategories = catchAsync(async (req, res) => {
  const queryOptions = buildQuery(req.query, ['name']);
  
  if (req.query.sortBy === 'category') {
    queryOptions.order = [[{ model: Category }, 'name', req.query.sortOrder?.toUpperCase() || 'ASC']];
  }

  const data = await SubCategory.findAndCountAll({
    ...queryOptions,
    include: [{ model: Category, attributes: ['name'] }]
  });

  return successResponse({
    res,
    message: MSG.CATEGORY.FETCHED,
    data: formatPaginatedResponse(data, req.query.page, req.query.limit)
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
/**
 * @desc Delete Category (Cascades to Subcategories & Products)
 */
export const deleteCategory = catchAsync(async (req, res) => {
  const { id } = req.params;

  await sequelize.transaction(async (t) => {
    // 1. Handle Products and their dependencies (Carts, Orders, Reviews)
    const products = await Product.findAll({ where: { categoryId: id }, transaction: t });
    const productIds = products.map(p => p.id);

    if (productIds.length > 0) {
      // Delete OrderItems (through table)
      await OrderItem.destroy({ where: { ProductId: productIds }, transaction: t });
      // Reviews, CartItems etc. usually have onDelete: CASCADE in models, 
      // but let's be explicit for Products belonging to this category
      await Product.destroy({ where: { id: productIds }, transaction: t });
    }
    
    // 2. SubCategories will be handled by DB CASCADE or manual delete
    await SubCategory.destroy({ where: { categoryId: id }, transaction: t });

    // 3. Finally delete category
    const deletedCount = await Category.destroy({ where: { id }, transaction: t });
    
    if (!deletedCount) {
        throw new Error('Category not found or already deleted');
    }
  });

  return successResponse({
    res,
    message: MSG.CATEGORY.DELETED
  });
});

/**
 * @desc Delete SubCategory (Cascades to Products)
 */
export const deleteSubCategory = catchAsync(async (req, res) => {
  const { id } = req.params;

  await sequelize.transaction(async (t) => {
    // 1. Handle Products and their dependencies
    const products = await Product.findAll({ where: { subCategoryId: id }, transaction: t });
    const productIds = products.map(p => p.id);

    if (productIds.length > 0) {
        await OrderItem.destroy({ where: { ProductId: productIds }, transaction: t });
        await Product.destroy({ where: { id: productIds }, transaction: t });
    }

    // 2. Delete the subcategory
    const deletedCount = await SubCategory.destroy({ where: { id }, transaction: t });

    if (!deletedCount) {
        throw new Error('Subcategory not found or already deleted');
    }
  });

  return successResponse({
    res,
    message: MSG.CATEGORY.SUBCATEGORY_DELETED
  });
});

/**
 * @desc Update Category (Admin Only)
 */
export const updateCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const category = await Category.findByPk(id);

  if (!category) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Category not found");
  }

  await category.update(req.body);

  // If status is changed to inactive, we might want to hide related products/subcategories
  if (req.body.status === 'inactive') {
      await SubCategory.update({ status: 'inactive' }, { where: { categoryId: id } });
      await Product.update({ status: 'hidden' }, { where: { categoryId: id } });
  }

  return successResponse({
    res,
    message: "Category updated successfully",
    data: category
  });
});

/**
 * @desc Update SubCategory (Admin Only)
 */
export const updateSubCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const subCategory = await SubCategory.findByPk(id);

  if (!subCategory) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Subcategory not found");
  }

  await subCategory.update(req.body);

  if (req.body.status === 'inactive') {
      await Product.update({ status: 'hidden' }, { where: { subCategoryId: id } });
  }

  return successResponse({
    res,
    message: "Subcategory updated successfully",
    data: subCategory
  });
});
