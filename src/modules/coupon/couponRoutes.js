import express from 'express';
import * as couponController from './couponController.js';
import { protect, restrictTo } from '../../middlewares/auth.js';

const router = express.Router();

router.post('/validate', protect, couponController.validateCoupon);
router.post('/create', protect, restrictTo('admin'), couponController.createCoupon);

export default router;
