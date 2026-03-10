import { StatusCodes } from 'http-status-codes';
import { errorResponse } from '../utils/responseFormat.js';

/**
 * @desc Global error handling middleware
 */
const errorMiddleware = (err, req, res, next) => {
  let { statusCode, message } = err;

  if (!statusCode) {
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  }

  // Set message for production
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    message = 'Internal Server Error';
  }

  return errorResponse({
    res,
    statusCode,
    message,
    error: err.stack // Consider removing stack in production
  });
};

export default errorMiddleware;
