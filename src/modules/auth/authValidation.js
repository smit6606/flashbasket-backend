import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().required(),
  user_name: Joi.string().optional().allow(null, ''),
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('user', 'seller', 'admin', 'delivery').required(),
  // Multi-vendor fields
  shop_name: Joi.string().when('role', { is: 'seller', then: Joi.required() }),
  owner_name: Joi.string().when('role', { is: 'seller', then: Joi.required() }),
  address: Joi.any().optional(),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  vehicleType: Joi.string().when('role', { is: 'delivery', then: Joi.required() }),
});

export const loginSchema = Joi.object({
  identifier: Joi.string().optional(),
  email: Joi.string().optional(),
  user_name: Joi.string().optional(),
  phone: Joi.string().optional(),
  password: Joi.string().required(),
  role: Joi.string().valid('user', 'seller', 'admin', 'delivery').required(),
}).or('identifier', 'email', 'user_name', 'phone');
