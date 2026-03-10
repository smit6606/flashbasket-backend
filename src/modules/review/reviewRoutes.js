import express from 'express';
import { createReview, getProductReviews } from './reviewController.js';
import protect from '../../middlewares/auth.js';

const router = express.Router();

router.get('/product/:productId', getProductReviews);

// Protected routes
router.use(protect);
router.post('/', createReview);

export default router;
