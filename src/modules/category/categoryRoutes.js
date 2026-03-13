import express from 'express';
import { 
  createCategory, 
  getCategories, 
  getCategoryById, 
  createSubCategory, 
  getSubCategories, 
  deleteCategory, 
  deleteSubCategory,
  updateCategory,
  updateSubCategory
} from './categoryController.js';
import protect, { restrictTo } from '../../middlewares/auth.js';

const router = express.Router();

router.get('/', getCategories);
router.get('/subcategories', getSubCategories);
router.get('/:id', getCategoryById);

// Admin and Seller routes
router.use(protect);
router.post('/', restrictTo('admin', 'seller'), createCategory);
router.post('/subcategory', restrictTo('admin', 'seller'), createSubCategory);
router.patch('/:id', restrictTo('admin', 'seller'), updateCategory);
router.patch('/subcategory/:id', restrictTo('admin', 'seller'), updateSubCategory);
router.delete('/:id', restrictTo('admin', 'seller'), deleteCategory);
router.delete('/subcategory/:id', restrictTo('admin', 'seller'), deleteSubCategory);

export default router;
