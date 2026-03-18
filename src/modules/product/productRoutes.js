import express from 'express';
import { 
  createProduct, 
  getAllProducts, 
  getSellerProducts, 
  getProductById, 
  searchProducts, 
  getProductsByCategory,
  updateProduct,
  deleteProduct,
  getAdminProducts
} from './productController.js';
import authMiddleware, { restrictTo, checkNotSuspended } from '../../middlewares/auth.js';
import { upload } from '../../middlewares/upload.js';

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/search', searchProducts);
router.get('/category/:id', getProductsByCategory);
router.get('/admin', authMiddleware, restrictTo('admin'), getAdminProducts);
router.get('/:id', getProductById);

// Protected routes (Sellers)
router.use(authMiddleware);
router.post('/', checkNotSuspended, upload.array('images', 10), createProduct);
router.patch('/:id', checkNotSuspended, upload.array('images', 10), updateProduct);
router.delete('/:id', checkNotSuspended, deleteProduct);
router.get('/seller/list', getSellerProducts);
router.get('/seller', getSellerProducts);

export default router;
