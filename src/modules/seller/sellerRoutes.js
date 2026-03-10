import express from 'express';
import { 
  createProduct, 
  updateProduct, 
  deleteProduct, 
  getSellerProducts 
} from '../product/productController.js';
import { updateSellerProfile } from './sellerController.js';
import protect, { restrictTo } from '../../middlewares/auth.js';

const router = express.Router();

// Apply seller restriction to all routes in this file
router.use(protect);
router.use(restrictTo('seller'));

router.post('/product', createProduct);
router.put('/product/:id', updateProduct);
router.delete('/product/:id', deleteProduct);
router.get('/products', getSellerProducts);
router.put('/profile', updateSellerProfile);

export default router;
