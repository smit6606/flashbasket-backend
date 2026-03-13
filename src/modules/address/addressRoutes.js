import express from 'express';
import * as addressController from './addressController.js';
import { protect } from '../../middlewares/auth.js';

const router = express.Router();

router.use(protect); // All address routes require login

router.post('/add', addressController.createAddress);
router.get('/all', addressController.getAddresses);
router.patch('/update/:id', addressController.updateAddress);
router.delete('/delete/:id', addressController.deleteAddress);
router.patch('/set-default/:id', addressController.setDefaultAddress);

export default router;
