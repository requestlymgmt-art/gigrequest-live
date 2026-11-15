// netlify/functions/capture-payment-intent.js
// Captures an authorized PaymentIntent when the band accepts a song request
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
      const capturedIntent = await stripe.paymentIntents.capture(paymentIntentId);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          status: capturedIntent.status,
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
        status: 'succeeded',
        mode: 'test_simulation',
      }),
    };
  } catch (err) {
    console.error('Capture payment intent error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Failed to capture payment',
      }),
    };
  }
};

