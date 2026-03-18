import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import authService from '../modules/auth/authService.js';
import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import { MSG } from '../utils/message.js';

/**
 * @desc Protect routes - Verify JWT and attach user
 * NOTE: This does NOT block suspended sellers so they can still access /auth/profile routes.
 *       Use checkNotSuspended for business-critical routes.
 */
export const protect = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, MSG.ACCESS.TOKEN_MISSING);
  }

  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(StatusCodes.UNAUTHORIZED, MSG.ACCESS.SESSION_EXPIRED);
    }
    throw new ApiError(StatusCodes.UNAUTHORIZED, MSG.ACCESS.TOKEN_INVALID);
  }

  if (!decoded.role || !decoded.id) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, MSG.ACCESS.TOKEN_INVALID);
  }

  const user = await authService.findById(decoded.role, decoded.id);

  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, MSG.ACCESS.TOKEN_DELETED);
  }

  req.user = user;
  req.role = decoded.role;
  next();
});

/**
 * @desc Block suspended sellers/delivery partners from performing business actions.
 *       Seller status ENUM uses PascalCase: 'Active' | 'Suspended'
 *       Apply this AFTER authMiddleware on product, order, etc. routes.
 */
export const checkNotSuspended = (req, res, next) => {
  const { user, role } = req;
  if (user?.status === 'Suspended') {
    const roleLabel = role === 'seller' ? 'seller' : 'delivery';
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      `Your ${roleLabel} account has been suspended. Please contact support to reactivate.`
    );
  }
  next();
};

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
