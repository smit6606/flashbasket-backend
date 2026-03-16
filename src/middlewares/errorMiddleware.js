import { StatusCodes } from 'http-status-codes';
import { errorResponse } from '../utils/responseFormat.js';

/**
 * @desc Global error handling middleware
 */
const errorMiddleware = (err, req, res, next) => {
  let { statusCode, message } = err;

  // Handle Sequelize Validation Errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    statusCode = StatusCodes.BAD_REQUEST;
    
    // Check if any sub-error is a unique constraint violation
    const uniqueError = err.errors?.find(e => e.message.includes('must be unique') || e.type === 'unique violation');
    
    if (uniqueError) {
      const field = uniqueError.path || 'entry';
      message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
    } else {
      message = err.errors ? err.errors.map(e => e.message).join(', ') : err.message;
    }
  }

  if (!statusCode) {
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  }

  // Set message for production
  if (process.env.NODE_ENV === 'production' && !err.isOperational && statusCode === StatusCodes.INTERNAL_SERVER_ERROR) {
    message = 'Internal Server Error';
  }

  return errorResponse({
    res,
    statusCode,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : null
  });
};

export default errorMiddleware;
