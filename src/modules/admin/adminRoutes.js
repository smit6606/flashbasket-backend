import express from 'express';
import { 
  getAllUsers, 
  getAllSellers, 
  getAllPartners, 
  updateSellerStatus, 
  getAdminStats 
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
router.patch('/seller/:id/status', updateSellerStatus);

export default router;
