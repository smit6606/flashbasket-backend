import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import authService from './authService.js';
import { MSG } from '../../utils/message.js';
import { successResponse } from '../../utils/responseFormat.js';
import ApiError from '../../utils/ApiError.js';
import catchAsync from '../../utils/catchAsync.js';

import { normalizePhoneNumber, isValidPhoneNumber } from '../../utils/phoneUtils.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../utils/cloudinary.js';

const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

/**
 * @desc    Register a new user
 */
export const register = catchAsync(async (req, res) => {
  let { email, user_name, phone, role, password, latitude, longitude } = req.body;

  // Normalize phone if provided
  if (phone) {
    phone = normalizePhoneNumber(phone);
    if (!isValidPhoneNumber(phone)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Please enter a valid 10-digit phone number");
    }
  }

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

  const userData = { ...req.body, phone };

  // If coordinates are provided, create a POINT for MySQL spatial index
  if (latitude || longitude) {
    const lat = latitude ? parseFloat(latitude) : null;
    const lng = longitude ? parseFloat(longitude) : null;
    
    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      userData.latitude = lat;
      userData.longitude = lng;
      userData.location = { type: 'Point', coordinates: [lng, lat] };
    } else {
      userData.latitude = null;
      userData.longitude = null;
      userData.location = null;
    }
  }

  const newUser = await authService.register(role, userData);
  const userResponse = newUser.toJSON();
  userResponse.role = role;
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
  let { identifier, email, user_name, phone, password, role } = req.body;
  
  // Normalize fields if they look like phone numbers
  if (phone) phone = normalizePhoneNumber(phone);
  if (identifier && !identifier.includes('@') && /^\d+$/.test(identifier.replace(/[^\d]/g, ''))) {
    identifier = normalizePhoneNumber(identifier);
  }

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
  userResponse.role = role;
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
 * @desc Update Profile
 */
export const updateProfile = catchAsync(async (req, res) => {
  const { id, role } = req;
  const user = await authService.findById(req.role, req.user.id);
  
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
  }

  const updateData = { ...req.body };

  // Normalize phone if provided in update
  if (updateData.phone) {
      updateData.phone = normalizePhoneNumber(updateData.phone);
      if (!isValidPhoneNumber(updateData.phone)) {
          throw new ApiError(StatusCodes.BAD_REQUEST, "Please enter a valid 10-digit phone number");
      }
      
      // Check if phone already exists for another user
      const existing = await authService.findByPhone(req.role, updateData.phone);
      if (existing && existing.id !== req.user.id) {
          throw new ApiError(StatusCodes.BAD_REQUEST, MSG.USER_ERROR.PHONE_EXISTS);
      }
  }

  // Rule: Email is read-only
  delete updateData.email;
  delete updateData.password; // Handled in changePassword

  // Handle Location if provided ( Seller / Delivery )
  if (updateData.latitude !== undefined || updateData.longitude !== undefined) {
    const latVal = updateData.latitude;
    const lngVal = updateData.longitude;
    
    const lat = (latVal === '' || latVal === null || isNaN(parseFloat(latVal))) ? null : parseFloat(latVal);
    const lng = (lngVal === '' || lngVal === null || isNaN(parseFloat(lngVal))) ? null : parseFloat(lngVal);

    updateData.latitude = lat;
    updateData.longitude = lng;

    if (lat !== null && lng !== null) {
        updateData.location = { 
            type: 'Point', 
            coordinates: [lng, lat] 
        };
    } else {
        updateData.location = null;
    }
  }

  // Handle Profile Image
  if (req.file) {
    // Delete old image if exists
    if (user.cloudinaryId) {
       await deleteFromCloudinary(user.cloudinaryId);
    }
    
    const result = await uploadToCloudinary(req.file.buffer, `Profiles/${req.role}`);
    updateData.profileImage = result.url;
    updateData.cloudinaryId = result.public_id;
  }

  await user.update(updateData);
  
  // Return without password
  const updatedUser = await authService.findByIdWithoutPassword(req.role, req.user.id);

  return successResponse({
    res,
    message: "Profile updated successfully",
    data: updatedUser
  });
});

/**
 * @desc Change Password
 */
export const changePassword = catchAsync(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Current and new password are required");
    }

    const user = await authService.findById(req.role, req.user.id);

    // Verify current password
    const isMatched = await bcrypt.compare(currentPassword, user.password);
    if (!isMatched) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Incorrect current password");
    }

    // Update password (hashing handled by model hook)
    user.password = newPassword;
    await user.save();

    return successResponse({
        res,
        message: "Password changed successfully"
    });
});

/**
 * @desc Logout
 */
export const logout = catchAsync(async (req, res) => {
  return successResponse({ res, message: MSG.AUTH.LOGOUT_SUCCESS });
});
