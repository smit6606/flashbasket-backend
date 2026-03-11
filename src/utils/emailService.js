import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send Email Notification
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content (optional)
 */
export const sendEmail = async (to, subject, text, html) => {
    try {
        const mailOptions = {
            from: `"FlashBasket" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text,
            html: html || `<p>${text}</p>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL] Sent to ${to}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[EMAIL ERROR] Failed to send to ${to}:`, error);
        // Don't throw for notifications (silent failure in background is often preferred)
        return null;
    }
};
