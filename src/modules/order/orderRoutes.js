import express from 'express';
import { 
  placeOrder, 
  getUserOrders, 
  getSellerOrders, 
  updateOrderStatus 
} from './orderController.js';
import protect, { restrictTo } from '../../middlewares/auth.js';

const router = express.Router();

router.use(protect);

// User routes
router.post('/place', restrictTo('user'), placeOrder);
router.get('/user', restrictTo('user'), getUserOrders);

// Seller routes
router.get('/seller', restrictTo('seller'), getSellerOrders);

// Shared Admin/Seller/Partner routes
router.patch('/:id/status', updateOrderStatus);

export default router;
