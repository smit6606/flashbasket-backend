import express from 'express';
import { toggleFavourite, getMyFavourites } from './favouriteController.js';
import protect from '../../middlewares/auth.js';

const router = express.Router();

router.use(protect);
router.post('/toggle', toggleFavourite);
router.get('/my', getMyFavourites);

export default router;
