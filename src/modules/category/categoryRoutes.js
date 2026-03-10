import express from 'express';
import { createCategory, getCategories, createSubCategory } from './categoryController.js';
import protect, { restrictTo } from '../../middlewares/auth.js';

const router = express.Router();

router.get('/', getCategories);

// Admin only routes
router.use(protect);
router.post('/', restrictTo('admin'), createCategory);
router.post('/subcategory', restrictTo('admin'), createSubCategory);

export default router;
