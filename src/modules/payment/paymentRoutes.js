import express from 'express';
import * as paymentController from './paymentController.js';
import authMiddleware from '../../middlewares/auth.js';

const router = express.Router();

router.post('/create-intent', authMiddleware, paymentController.createPaymentIntent);

export default router;
