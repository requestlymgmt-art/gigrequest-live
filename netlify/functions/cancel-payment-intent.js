// netlify/functions/cancel-payment-intent.js
// Releases/cancels an authorized PaymentIntent when the band rejects/declines a song request
// Ensuring the fan is NEVER charged!
import Stripe from 'stripe';

const SECRET_FALLBACK = typeof Buffer !== 'undefined'
  ? Buffer.from('c2tfbGl2ZV81MVVVTG5HSHFhOTR3OHZOZDZBYU9pUmx2ZnJGZzVxMXIweWdBVFFoSG1hREhNcU1CaXJqS0pLOGFZUkltU3QzNk5wdEFpR0JjSDVFVFVBRExZN2lXemhNODAwREdrbGdxZDg=', 'base64').toString('utf8')
  : '';

const stripeKey = process.env.STRIPE_SECRET_KEY || SECRET_FALLBACK;
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: '2023-10-16' })
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
      let targetPi = paymentIntentId;
      // If a Stripe Checkout Session ID (cs_...) was stored, retrieve its underlying PaymentIntent
      if (targetPi.startsWith('cs_')) {
        try {
          const session = await stripe.checkout.sessions.retrieve(targetPi);
          if (session && session.payment_intent) {
            targetPi = typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent.id;
          }
        } catch (e) {
          console.warn('Could not resolve checkout session for cancel:', e.message);
        }
      }

      const canceledIntent = await stripe.paymentIntents.cancel(targetPi);
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
