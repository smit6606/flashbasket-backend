import { User, Seller, DeliveryPartner } from '../models/index.js';
import { sendEmail } from './emailService.js';

/**
 * Universal Notification Dispatcher
 */
export const sendNotification = async (userId, userType, message, type = 'email') => {
    // 1. Log to console for debugging
    console.log(`[NOTIFICATION] ${type.toUpperCase()} -> ${userType} (${userId}): ${message}`);

    // 2. Real Email Logic
    if (type === 'email') {
        try {
            let user = null;
            if (userType === 'user') user = await User.findByPk(userId);
            else if (userType === 'seller') user = await Seller.findByPk(userId);
            else if (userType === 'delivery') user = await DeliveryPartner.findByPk(userId);

            if (user?.email) {
                const subject = message.includes('OTP') ? "FlashBasket Delivery OTP" : "FlashBasket Order Update";
                await sendEmail(user.email, subject, message);
            }
        } catch (error) {
            console.error("Failed to send email notification:", error);
        }
    }

    // Simulate small delay like real network
    return new Promise(resolve => setTimeout(resolve, 50));
};

/**
 * High-level Order Status Notifier
 */
export const notifyOrderStatusChange = async (order) => {
    const status = order.status;
    const orderNum = order.orderNumber;
    
    // Default messages
    let userMsg = `Your order ${orderNum} is now ${status.replace(/-/g, ' ')}.`;
    let sellerMsg = `Order ${orderNum} status updated to ${status}.`;
    let adminMsg = `Order ${orderNum} status updated to ${status}.`;
    let partnerMsg = `Assignment updated for order ${orderNum} (Status: ${status}).`;

    // Role-specific notification logic
    if (status === 'awaiting-assignment') {
        adminMsg = `New delivery assignment request for order ${orderNum} from seller.`;
    } else if (status === 'assigned') {
        sellerMsg = `Delivery boy assigned for order ${orderNum}. Waiting for admin to dispatch.`;
    } else if (status === 'ready-to-ship') {
        sellerMsg = `Admin has cleared order ${orderNum} for shipping. Please start dispatch.`;
    } else if (status === 'shipped') {
        partnerMsg = `Order ${orderNum} is ready for pick up at the seller's location.`;
    } else if (status === 'arrived') {
        userMsg = `Your delivery verification OTP is ${order.deliveryOtp}. Share this OTP with the delivery partner to receive your order. Note: Valid for 10 minutes.`;
        partnerMsg = `You have arrived at the location for order ${orderNum}. Please verify OTP.`;
    } else if (status === 'completed') {
        userMsg = `Order Completed. Enjoy your items!`;
        sellerMsg = `Your order ${orderNum} has been delivered.`;
        adminMsg = `Order ${orderNum} Delivered Successfully.`;
    }

    // Notify User only on CRITICAL statuses
    const criticalStatuses = ['ready-to-ship', 'out-for-delivery', 'arrived', 'completed'];
    if (criticalStatuses.includes(status)) {
        await sendNotification(order.userId, 'user', userMsg, 'email');
    }

    // Notify Seller
    if (order.sellerId) {
        await sendNotification(order.sellerId, 'seller', sellerMsg, 'email');
    }

    // Notify Delivery Partner if assigned
    if (order.deliveryPartnerId) {
        await sendNotification(order.deliveryPartnerId, 'delivery', partnerMsg, 'email');
    }
    
    // Admin Notifications
    console.log(`[ADMIN NOTIFICATION]: ${adminMsg}`);

    // Trigger Invoice Email on completion
    if (status === 'completed') {
        sendInvoiceEmail(order.userId, order.groupId);
    }
};

/**
 * Send Consolidated HTML Invoice via Email
 */
export const sendInvoiceEmail = async (userId, groupId) => {
    try {
        const user = await User.findByPk(userId);
        if (!user || !user.email) return;

        // Fetch consolidated order data
        const orders = await sequelize.models.Order.findAll({
            where: { groupId },
            include: [
                { model: sequelize.models.Product, through: { attributes: ['quantity', 'price'] } },
                { model: sequelize.models.Seller, attributes: ['shop_name'] }
            ]
        });

        if (!orders.length) return;

        let itemsHtml = '';
        let subtotal = 0;
        let deliveryFee = 0;

        orders.forEach(order => {
            deliveryFee += parseFloat(order.deliveryFee);
            order.Products.forEach(prod => {
                const total = prod.OrderItem.quantity * prod.OrderItem.price;
                subtotal += total;
                itemsHtml += `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #eee;">${prod.productName}<br/><small style="color: #666;">Sold by: ${order.Seller.shop_name}</small></td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${prod.OrderItem.quantity}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">INR ${prod.OrderItem.price}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">INR ${total.toFixed(2)}</td>
                    </tr>
                `;
            });
        });

        const totalAmount = subtotal + deliveryFee;

        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #0C831F; margin-bottom: 5px;">FLASHBASKET</h1>
                    <p style="color: #666; margin-top: 0;">Your Fresh Essentials, Delivered.</p>
                </div>
                <hr/>
                <h3>Order Invoice: #${groupId}</h3>
                <p>Hi ${user.user_name || 'Customer'}, your order has been successfully delivered and completed! Thank you for choosing FlashBasket.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background: #f8f8f8;">
                            <th style="padding: 12px; text-align: left;">Item</th>
                            <th style="padding: 12px; text-align: center;">Qty</th>
                            <th style="padding: 12px; text-align: right;">Price</th>
                            <th style="padding: 12px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <div style="margin-top: 20px; text-align: right;">
                    <p>Subtotal: <strong>INR ${subtotal.toFixed(2)}</strong></p>
                    <p>Delivery Fee: <strong>INR ${deliveryFee.toFixed(2)}</strong></p>
                    <h2 style="color: #0C831F;">Total: INR ${totalAmount.toFixed(2)}</h2>
                </div>

                <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 5px; font-size: 13px; color: #666;">
                    <p style="margin: 0;"><strong>Delivery Address:</strong><br/>${orders[0].deliveryAddress}</p>
                </div>

                <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                    FlashBasket Inc. | Neighborhood Express Delivery
                </p>
            </div>
        `;

        await sendEmail(user.email, `Invoice for your FlashBasket Order #${groupId}`, "", html);
    } catch (error) {
        console.error("Failed to send invoice email:", error);
    }
};
