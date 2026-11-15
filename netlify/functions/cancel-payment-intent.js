// netlify/functions/cancel-payment-intent.js
// Releases/cancels an authorized PaymentIntent when the band rejects/declines a song request
// Ensuring the fan is NEVER charged!
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { paymentIntentId } = body;

    if (!paymentIntentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing paymentIntentId' }),
      };
    }

    if (stripe && process.env.STRIPE_SECRET_KEY && !paymentIntentId.startsWith('pi_hold_') && !paymentIntentId.startsWith('pi_test_')) {
      const canceledIntent = await stripe.paymentIntents.cancel(paymentIntentId);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: canceledIntent.status,
          mode: 'live_stripe',
        }),
      };
    }

    // In simulation / test mode:
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        status: 'canceled',
        mode: 'test_simulation',
      }),
    };
  } catch (err) {
    console.error('Cancel payment intent error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Failed to cancel authorization hold',
      }),
    };
  }
};

