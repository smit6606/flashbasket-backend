import express from 'express';
import { 
  createProduct, 
  getAllProducts, 
  getSellerProducts, 
  getProductById, 
  searchProducts, 
  getProductsByCategory 
} from './productController.js';
import authMiddleware from '../../middlewares/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/search', searchProducts);
router.get('/:id', getProductById);
router.get('/category/:id', getProductsByCategory);

// Seller routes
router.use(authMiddleware);
router.post('/', createProduct);
router.get('/seller', getSellerProducts);

export default router;
