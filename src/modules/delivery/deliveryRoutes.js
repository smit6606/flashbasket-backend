import express from 'express';
import { 
  getAvailableOrders, 
  acceptOrder, 
  pickupOrder, 
  completeDelivery, 
  getMyDeliveries 
} from './deliveryController.js';
import protect, { restrictTo } from '../../middlewares/auth.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo('delivery'));

router.get('/available', getAvailableOrders);
router.get('/my-orders', getMyDeliveries);
router.patch('/:id/accept', acceptOrder);
router.patch('/:id/pickup', pickupOrder);
router.patch('/:id/complete', completeDelivery);

export default router;
