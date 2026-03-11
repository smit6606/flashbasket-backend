import express from 'express';
import { 
  createProduct, 
  getAllProducts, 
  getSellerProducts, 
  getProductById, 
  searchProducts, 
  getProductsByCategory,
  updateProduct,
  deleteProduct
} from './productController.js';
import authMiddleware from '../../middlewares/auth.js';
import { upload } from '../../middlewares/upload.js';

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/seller/list', authMiddleware, getSellerProducts); // Adjusted to avoid conflict with /:id
router.get('/search', searchProducts);
router.get('/:id', getProductById);
router.get('/category/:id', getProductsByCategory);

// Protected routes (Sellers)
router.use(authMiddleware);
router.post('/', upload.array('images', 10), createProduct);
router.patch('/:id', upload.array('images', 10), updateProduct);
router.delete('/:id', deleteProduct);
router.get('/seller', getSellerProducts);

export default router;
