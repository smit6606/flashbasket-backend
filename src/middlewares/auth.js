import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import authService from '../modules/auth/authService.js';
import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import { MSG } from '../utils/message.js';

/**
 * @desc Protect routes - Verify JWT and attach user
 */
export const protect = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, MSG.ACCESS.TOKEN_MISSING);
  }

  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (!decoded.role || !decoded.id) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, MSG.ACCESS.TOKEN_INVALID);
  }

  const user = await authService.findById(decoded.role, decoded.id);

  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, MSG.ACCESS.TOKEN_DELETED);
  }

  // Admin Panel - Enforce account suspension instantly for non-customers
  if (user.status) {
    if (decoded.role === 'seller' && ['suspended', 'rejected'].includes(user.status)) {
        throw new ApiError(StatusCodes.FORBIDDEN, `Seller account is ${user.status}. Access denied.`);
    }
    if (decoded.role === 'delivery' && user.status === 'suspended') {
        throw new ApiError(StatusCodes.FORBIDDEN, "Delivery partner account is suspended.");
    }
    if (decoded.role === 'customer' && user.status === 'blocked') {
        throw new ApiError(StatusCodes.FORBIDDEN, "Your account has been blocked by the administration.");
    }
  }

  req.user = user;
  req.role = decoded.role;
  next();
});

/**
 * @desc Restrict access based on roles
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.role)) {
      throw new ApiError(StatusCodes.FORBIDDEN, "You do not have permission to perform this action");
    }
    next();
  };
};

// Export as default for backward compatibility if needed elsewhere
export default protect;
