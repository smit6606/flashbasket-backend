import express from 'express';
import {
  getAllPartners,
  updateSellerStatus,
  getAdminCommissionStats,
  getAllOrders,
  assignDeliveryPartner,
  dispatchOrderToSeller,
  getAdminStats,
  getAllUsers,
  getAllSellers,
  getUnifiedUsers,
  updateUnifiedUserStatus
} from './adminController.js';
import protect, { restrictTo } from '../../middlewares/auth.js';

const router = express.Router();

// All admin routes are protected and restricted to admin
router.use(protect);
router.use(restrictTo('admin'));

router.get('/stats', getAdminStats);
router.get('/unified-users', getUnifiedUsers);
router.patch('/unified-users/:role/:id/status', updateUnifiedUserStatus);
router.get('/users', getAllUsers);
router.get('/sellers', getAllSellers);
router.get('/partners', getAllPartners);
router.get('/orders', getAllOrders);
router.get('/orders/completed', (req, res, next) => {
  req.query.status = 'Delivered,Completed';
  getAllOrders(req, res, next);
});
router.get('/commission', getAdminCommissionStats);
router.put('/assign-delivery', assignDeliveryPartner);
router.put('/dispatch-order/:orderId', dispatchOrderToSeller);
router.patch('/seller/:id/status', updateSellerStatus);

export default router;
