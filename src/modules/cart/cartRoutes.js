import express from 'express';
import { 
  addToCart, 
  getCart, 
  updateCart, 
  removeFromCart 
} from './cartController.js';
import authMiddleware from '../../middlewares/auth.js';

const router = express.Router();

// All cart routes require authentication
router.use(authMiddleware);

router.post('/add', addToCart);
router.get('/', getCart);
router.put('/update', updateCart);
router.delete('/remove', removeFromCart);

export default router;
