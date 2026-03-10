/**
 * Notification Service (Mock for SMS/Email)
 */
export const sendNotification = async (userId, userType, message, type = 'email') => {
    // In production, integrate with SendGrid, Twilio, etc.
    console.log(`[NOTIFICATION] Sending ${type} to ${userType} (ID: ${userId}): ${message}`);

    // Simulate async network delay
    return new Promise(resolve => setTimeout(resolve, 100));
};

export const notifyOrderStatusChange = async (order) => {
    const message = `Your order ${order.orderNumber} is now ${order.status.toUpperCase()}.`;

    // Notify User
    await sendNotification(order.userId, 'user', message, 'email');

    // Notify Seller
    await sendNotification(order.sellerId, 'seller', `Order ${order.orderNumber} has been updated to ${order.status}.`, 'email');
};
