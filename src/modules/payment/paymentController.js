import Stripe from 'stripe';
import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { successResponse } from '../../utils/responseFormat.js';
import ApiError from '../../utils/ApiError.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * @desc Create a Payment Intent
 */
export const createPaymentIntent = catchAsync(async (req, res) => {
    const { amount, currency = 'inr' } = req.body;

    if (!amount) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Amount is required');
    }

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amount in cents/paisa
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
            enabled: true,
        },
    });

    return successResponse({
        res,
        statusCode: StatusCodes.OK,
        message: 'Payment intent created',
        data: {
            clientSecret: paymentIntent.client_secret,
        },
    });
});
