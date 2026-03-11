import { Order, OrderItem, Product, Seller, User } from '../../models/index.js';
import { successResponse } from '../../utils/responseFormat.js';
import catchAsync from '../../utils/catchAsync.js';
import ApiError from '../../utils/ApiError.js';
import { StatusCodes } from 'http-status-codes';

/**
 * @desc Generate Invoice Data for User (Consolidated by groupId)
 */
export const getUserInvoice = catchAsync(async (req, res) => {
    const { orderId } = req.params; // Using orderId as a bridge to find groupId or using it as search term

    // Find the primary order to get groupId
    const initialOrder = await Order.findByPk(orderId);
    if (!initialOrder) throw new ApiError(StatusCodes.NOT_FOUND, "Order not found");

    const groupId = initialOrder.groupId || initialOrder.orderNumber;

    const orders = await Order.findAll({
        where: { groupId },
        include: [
            { model: Product, through: { attributes: ['quantity', 'price'] } },
            { model: Seller, attributes: ['shop_name', 'address', 'phone'] },
            { model: User, attributes: ['user_name', 'email', 'phone'] }
        ]
    });

    if (!orders || orders.length === 0) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Invoice not found");
    }

    // Basic security
    if (orders[0].userId !== req.user.id && req.role !== 'admin') {
        throw new ApiError(StatusCodes.FORBIDDEN, "Access denied");
    }

    const firstOrder = orders[0];
    const invoice = {
        invoiceNumber: groupId,
        date: firstOrder.createdAt,
        customer: {
            name: firstOrder.User.user_name,
            email: firstOrder.User.email,
            phone: firstOrder.User.phone,
            address: firstOrder.deliveryAddress
        },
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        totalAmount: 0,
        paymentMethod: firstOrder.paymentMethod,
        paymentStatus: firstOrder.paymentStatus
    };

    orders.forEach(order => {
        invoice.deliveryFee += parseFloat(order.deliveryFee);
        order.Products.forEach(prod => {
            const lineTotal = parseFloat(prod.OrderItem.price) * prod.OrderItem.quantity;
            invoice.items.push({
                name: prod.productName,
                shopName: order.Seller.shop_name,
                quantity: prod.OrderItem.quantity,
                price: prod.OrderItem.price,
                total: lineTotal.toFixed(2)
            });
            invoice.subtotal += lineTotal;
        });
    });

    invoice.totalAmount = (invoice.subtotal + invoice.deliveryFee).toFixed(2);
    invoice.subtotal = invoice.subtotal.toFixed(2);
    invoice.deliveryFee = invoice.deliveryFee.toFixed(2);

    return successResponse({
        res,
        message: "Consolidated invoice data fetched",
        data: invoice
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
