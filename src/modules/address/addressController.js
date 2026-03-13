import { Address } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';

export const createAddress = catchAsync(async (req, res) => {
  const { isDefault } = req.body;
  
  if (isDefault) {
    await Address.update({ isDefault: false }, { where: { userId: req.user.id } });
  }

  const address = await Address.create({
    ...req.body,
    userId: req.user.id
  });

  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: "Address added successfully",
    data: address
  });
});

export const getAddresses = catchAsync(async (req, res) => {
  const addresses = await Address.findAll({
    where: { userId: req.user.id },
    order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
  });

  return successResponse({
    res,
    message: "Addresses fetched",
    data: addresses
  });
});

export const updateAddress = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { isDefault } = req.body;

  const address = await Address.findOne({ where: { id, userId: req.user.id } });
  if (!address) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Address not found");
  }

  if (isDefault && !address.isDefault) {
    await Address.update({ isDefault: false }, { where: { userId: req.user.id } });
  }

  await address.update(req.body);

  return successResponse({
    res,
    message: "Address updated successfully",
    data: address
  });
});

export const deleteAddress = catchAsync(async (req, res) => {
  const { id } = req.params;
  const deletedCount = await Address.destroy({ where: { id, userId: req.user.id } });

  if (!deletedCount) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Address not found");
  }

  return successResponse({
    res,
    message: "Address deleted successfully"
  });
});

export const setDefaultAddress = catchAsync(async (req, res) => {
  const { id } = req.params;

  const address = await Address.findOne({ where: { id, userId: req.user.id } });
  if (!address) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Address not found");
  }

  await Address.update({ isDefault: false }, { where: { userId: req.user.id } });
  await address.update({ isDefault: true });

  return successResponse({
    res,
    message: "Default address set"
  });
});
