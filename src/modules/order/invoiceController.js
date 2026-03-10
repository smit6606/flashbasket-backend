import { Order, OrderItem, Product, Seller, User } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';

/**
 * @desc Generate Invoice Data for User (Consolidated)
 */
export const getUserInvoice = catchAsync(async (req, res) => {
    const { orderId } = req.params;

    const order = await Order.findByPk(orderId, {
        include: [
            { model: Product, through: { attributes: ['quantity', 'price'] } },
            { model: Seller, attributes: ['shop_name', 'address'] },
            { model: User, attributes: ['name', 'email'] }
        ]
    });

    if (!order) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");
    }

    // Basic security
    if (order.userId !== req.user.id && req.role !== 'admin') {
        throw new ApiError(StatusCodes.FORBIDDEN, "Access denied");
    }

    return successResponse({
        res,
        message: "User invoice data fetched",
        data: {
            invoiceNumber: `INV-${order.orderNumber}`,
            date: order.createdAt,
            customer: order.User,
            items: order.Products.map(p => ({
                name: p.productName,
                quantity: p.OrderItem.quantity,
                price: p.OrderItem.price,
                total: p.OrderItem.quantity * p.OrderItem.price
            })),
            seller: order.Seller,
            subtotal: order.totalAmount - order.deliveryFee,
            deliveryFee: order.deliveryFee,
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod
        }
    });
});

/**
 * @desc Generate Invoice Data for Seller (Split)
 */
export const getSellerInvoice = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    const sellerId = req.user.id;

    const order = await Order.findOne({
        where: { id: orderId, sellerId },
        include: [
            { model: Product, through: { attributes: ['quantity', 'price'] } },
            { model: User, attributes: ['name', 'email'] }
        ]
    });

    if (!order) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Order not found for this seller");
    }

    const sellerEarnings = order.totalAmount - order.commissionAmount - order.deliveryFee;

    return successResponse({
        res,
        message: "Seller invoice data fetched",
        data: {
            invoiceNumber: `SEL-INV-${order.orderNumber}`,
            date: order.createdAt,
            customer: order.User,
            items: order.Products.map(p => ({
                name: p.productName,
                quantity: p.OrderItem.quantity,
                price: p.OrderItem.price,
                total: p.OrderItem.quantity * p.OrderItem.price
            })),
            subtotal: order.totalAmount - order.deliveryFee,
            commission: order.commissionAmount,
            earnings: sellerEarnings,
            totalAmount: order.totalAmount
        }
    });
});
