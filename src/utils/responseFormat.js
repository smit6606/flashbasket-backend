/**
 * Standard Success Response
 */
export const successResponse = ({
  res,
  statusCode = 200,
  message = "Request successful.",
  data = null,
}) => {
  return res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
  });
};

/**
 * Standard Error Response
 */
export const errorResponse = ({
  res,
  statusCode = 500,
  message = "Internal server error.",
  error = null,
}) => {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    error: error?.message || error,
  });
};
