import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import authService from './authService.js';
import { MSG } from '../../utils/message.js';
import { successResponse } from '../../utils/responseFormat.js';
import ApiError from '../../utils/ApiError.js';
import catchAsync from '../../utils/catchAsync.js';

const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

/**
 * @desc    Register a new user
 */
export const register = catchAsync(async (req, res) => {
  const { email, user_name, phone, role, password, latitude, longitude } = req.body;

  if (!role) {
    throw new ApiError(StatusCodes.BAD_REQUEST, MSG.AUTH.INVALID_ROLE);
  }

  // Check availability
  if (email) {
    const emailExist = await authService.findByEmail(role, email);
    if (emailExist) {
      throw new ApiError(StatusCodes.BAD_REQUEST, MSG.USER_ERROR.EMAIL_EXISTS);
    }
  }

  if (user_name) {
    const usernameExist = await authService.findByUsername(role, user_name);
    if (usernameExist) {
      throw new ApiError(StatusCodes.BAD_REQUEST, MSG.USER_ERROR.USERNAME_EXISTS);
    }
  }

  if (phone) {
    const phoneExist = await authService.findByPhone(role, phone);
    if (phoneExist) {
      throw new ApiError(StatusCodes.BAD_REQUEST, MSG.USER_ERROR.PHONE_EXISTS);
    }
  }

  const userData = { ...req.body };

  // If coordinates are provided, create a POINT for MySQL spatial index
  if (latitude && longitude) {
    userData.location = { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] };
  }

  const newUser = await authService.register(role, userData);
  const userResponse = newUser.toJSON();
  delete userResponse.password;

  return successResponse({
    res,
    statusCode: StatusCodes.CREATED,
    message: MSG.USER.CREATED,
    data: userResponse,
  });
});

/**
 * @desc    Login user
 */
export const login = catchAsync(async (req, res) => {
  const { identifier, email, user_name, phone, password, role } = req.body;
  const loginField = identifier || email || user_name || phone;

  if (!password || !role || !loginField) {
    throw new ApiError(StatusCodes.BAD_REQUEST, MSG.REQUEST.MISSING_FIELDS);
  }

  const user = await authService.findByLoginField(role, loginField);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, MSG.AUTH.LOGIN_FAILED);
  }

  const token = signToken(user.id, role);
  const userResponse = user.toJSON();
  delete userResponse.password;

  return successResponse({
    res,
    statusCode: StatusCodes.OK,
    message: MSG.AUTH.LOGIN_SUCCESS,
    data: { token, user: userResponse },
  });
});

/**
 * @desc Get Profile
 */
export const getProfile = catchAsync(async (req, res) => {
  const user = await authService.findByIdWithoutPassword(req.role, req.user.id);
  return successResponse({
    res,
    message: MSG.USER.PROFILE_FETCHED,
    data: user
  });
});

/**
 * @desc Logout
 */
export const logout = catchAsync(async (req, res) => {
  return successResponse({ res, message: MSG.AUTH.LOGOUT_SUCCESS });
});
