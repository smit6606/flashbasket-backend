import express from 'express';
import { getNearbySellers, fetchAllSellers, getSellerById } from './sellerController.js';

const router = express.Router();

/**
 * @desc Get all sellers nearby (Haversine formula)
 * @params lat, lng, distance
 */
router.get('/nearby', getNearbySellers);

/**
 * @desc List all sellers
 */
router.get('/', fetchAllSellers);
/**
 * @desc Get single seller by ID
 */
router.get('/:id', getSellerById);

export default router;
