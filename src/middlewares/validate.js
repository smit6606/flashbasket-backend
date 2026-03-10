import { StatusCodes } from 'http-status-codes';
import { errorResponse } from '../utils/responseFormat.js';

export const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const message = error.details.map((detail) => detail.message).join(', ');
    return errorResponse({
      res,
      statusCode: StatusCodes.BAD_REQUEST,
      message,
    });
  }
  next();
};
