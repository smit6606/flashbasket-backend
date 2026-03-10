import express from 'express';
import {
  getAllPartners,
  updateSellerStatus,
  getAdminCommissionStats,
  getAllOrders,
  assignDeliveryPartner,
  getAdminStats,
  getAllUsers,
  getAllSellers
} from './adminController.js';
import protect, { restrictTo } from '../../middlewares/auth.js';

const router = express.Router();

// All admin routes are protected and restricted to admin
router.use(protect);
router.use(restrictTo('admin'));

router.get('/stats', getAdminStats);
router.get('/users', getAllUsers);
router.get('/sellers', getAllSellers);
router.get('/partners', getAllPartners);
router.get('/orders', getAllOrders);
router.get('/commission', getAdminCommissionStats);
router.put('/assign-delivery', assignDeliveryPartner);
router.patch('/seller/:id/status', updateSellerStatus);

export default router;
