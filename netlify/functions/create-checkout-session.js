// netlify/functions/create-checkout-session.js
// Handles real-money Stripe Checkout Sessions with Apple Pay, Google Pay, and Stripe Connect transfers
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
    const {
      amount, // Total charged in dollars (e.g. 17.82)
      requestlyFee = 0,
      bandStripeAccountId,
      songTitle = 'Song Request',
      fanName = 'Anonymous Fan',
      bandId,
      slug = 'live',
      origin = 'https://fluffy-swan-6c20ad.netlify.app',
      currency = 'usd',
    } = body;

    const amountInCents = Math.round(Number(amount) * 100);
    const feeInCents = Math.round(Number(requestlyFee) * 100);

    // If real Stripe secret key is present in Netlify environment variables:
    if (stripe && process.env.STRIPE_SECRET_KEY) {
      const sessionParams = {
        payment_method_types: ['card'], // Automatically includes Apple Pay & Google Pay
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `Song Request: ${songTitle}`,
                description: `Live performance request from ${fanName}`,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          bandId: bandId || '',
          songTitle,
          fanName,
          requestlyFee: requestlyFee.toString(),
        },
        success_url: `${origin}/live/${slug}?session_id={CHECKOUT_SESSION_ID}&payment_success=true&song=${encodeURIComponent(songTitle)}`,
        cancel_url: `${origin}/live/${slug}?payment_cancelled=true`,
      };

      // Direct payout to band via Stripe Connect if account is linked
      if (bandStripeAccountId && bandStripeAccountId.startsWith('acct_')) {
        sessionParams.payment_intent_data = {
          application_fee_amount: feeInCents,
          transfer_data: {
            destination: bandStripeAccountId,
          },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          sessionId: session.id,
          url: session.url,
          mode: 'stripe_checkout_redirect',
        }),
      };
    }

    // In demo / preview mode without live API key:
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        sessionId: `cs_test_${Math.random().toString(36).substring(2, 10)}`,
        url: null,
        mode: 'test_simulation',
      }),
    };
  } catch (err) {
    console.error('Stripe Checkout session error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Failed to create Checkout session',
      }),
    };
  }
};
