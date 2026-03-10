import express from 'express';
import { getNearbySellers, fetchAllSellers } from './sellerController.js';

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

export default router;
