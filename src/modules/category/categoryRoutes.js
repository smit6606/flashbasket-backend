import express from 'express';
import { createCategory, getCategories, createSubCategory } from './categoryController.js';
import protect, { restrictTo } from '../../middlewares/auth.js';

const router = express.Router();

router.get('/', getCategories);

// Admin and Seller routes
router.use(protect);
router.post('/', restrictTo('admin', 'seller'), createCategory);
router.post('/subcategory', restrictTo('admin', 'seller'), createSubCategory);

export default router;
