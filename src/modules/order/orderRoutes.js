import express from 'express';
import {
  placeOrder,
  getUserOrders,
  getSellerOrders,
  getPartnerOrders,
  updateOrderStatus,
  resendOtp,
  trackOrder,
  getOrderLogs
} from './orderController.js';
import { getUserInvoice, getSellerInvoice } from './invoiceController.js';
import protect, { restrictTo } from '../../middlewares/auth.js';

const router = express.Router();

router.use(protect);

// User routes
router.post('/create', restrictTo('user'), placeOrder);
router.get('/user', restrictTo('user'), getUserOrders);
router.get('/track/:orderNumber', trackOrder);
router.get('/:orderId/invoice', getUserInvoice);

// Seller routes
router.get('/seller', restrictTo('seller'), getSellerOrders);
router.get('/seller/:orderId/invoice', restrictTo('seller'), getSellerInvoice);

// Partner routes
router.get('/partner', restrictTo('delivery'), getPartnerOrders);
router.post('/:id/resend-otp', restrictTo('delivery'), resendOtp);

// Shared routes
router.patch('/:id/status', updateOrderStatus);
router.get('/:id/logs', getOrderLogs);

export default router;
