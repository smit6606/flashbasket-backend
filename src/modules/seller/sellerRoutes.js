import express from 'express';
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getSellerProducts
} from '../product/productController.js';
import { updateSellerProfile, getSellerDashboardStats } from './sellerController.js';
import protect, { restrictTo } from '../../middlewares/auth.js';

import { upload } from '../../middlewares/upload.js';

const router = express.Router();

// Apply seller restriction to all routes in this file
router.use(protect);
router.use(restrictTo('seller'));

router.post('/products', upload.array('images', 5), createProduct);
router.put('/product/:id', upload.array('images', 5), updateProduct);
router.delete('/product/:id', deleteProduct);
router.get('/products', getSellerProducts);
router.get('/dashboard', getSellerDashboardStats);
router.put('/profile', updateSellerProfile);

export default router;
