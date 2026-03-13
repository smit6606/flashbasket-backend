import express from 'express';
import { register, login, logout, getProfile, updateProfile, changePassword } from './authController.js';
import authMiddleware from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { registerSchema, loginSchema } from './authValidation.js';
import { upload } from '../../middlewares/upload.js';

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/logout', authMiddleware, logout);
router.get('/profile', authMiddleware, getProfile);
router.patch('/profile-update', authMiddleware, upload.single('profileImage'), updateProfile);
router.patch('/change-password', authMiddleware, changePassword);

export default router;
