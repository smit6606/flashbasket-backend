import express from 'express';
import authMiddleware from '../middlewares/auth.js';
import authRoutes from '../modules/auth/authRoutes.js';
import productRoutes from '../modules/product/productRoutes.js';
import categoryRoutes from '../modules/category/categoryRoutes.js';
import sellerRoutes from '../modules/seller/sellerRoutes.js';
import publicSellerRoutes from '../modules/seller/publicSellerRoutes.js';
import cartRoutes from '../modules/cart/cartRoutes.js';
import adminRoutes from '../modules/admin/adminRoutes.js';
import orderRoutes from '../modules/order/orderRoutes.js';
import reviewRoutes from '../modules/review/reviewRoutes.js';
import deliveryRoutes from '../modules/delivery/deliveryRoutes.js';

const router = express.Router();

// Public routes
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/seller', sellerRoutes);
router.use('/sellers', publicSellerRoutes);
router.use('/cart', cartRoutes);
router.use('/admin', adminRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/delivery', deliveryRoutes);

// Protected routes section
// router.use(authMiddleware); 
// router.use('/user', userRoutes);

export default router;
