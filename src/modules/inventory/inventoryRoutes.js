import express from 'express';
import { Product, Seller } from '../../models/index.js';
import { allocateInventory } from '../../utils/inventoryAllocator.js';
import { successResponse } from '../../utils/responseFormat.js';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';

const router = express.Router();

/**
 * @desc Test Allocation Endpoint
 * POST /api/inventory/allocate
 */
router.post('/allocate', catchAsync(async (req, res) => {
    const { productName, requiredQuantity } = req.body;

    // Fetch all sellers that have this product
    const products = await Product.findAll({
        where: { productName },
        include: [{ model: Seller, attributes: ['id', 'shop_name'] }]
    });

    if (products.length === 0) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Product not found across any sellers" });
    }

    // Map to simplified format for allocator
    const sellerList = products.map(p => ({
        id: p.Seller.id,
        shop_name: p.Seller.shop_name,
        stock: p.stock
    }));

    const result = allocateInventory(sellerList, parseFloat(requiredQuantity));

    return successResponse({
        res,
        message: "Smart allocation calculated",
        data: result
    });
}));

export default router;
