// netlify/functions/create-payment-intent.js
// Handles Stripe PaymentIntent creation with authorization hold (manual capture) for song requests
// and automatic capture for direct tips, with Stripe Connect transfers.
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

export const handler = async (event) => {
  // CORS headers
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
      requestlyFee, // Requestly fee in dollars (e.g. 2.00)
      bandStripeAccountId, // Connect account id of the band (e.g. acct_123)
      songTitle,
      fanName,
      bandId,
      isDirectTip = false, // Direct tip = auto capture, Song request = manual capture (only charged when accepted!)
      currency = 'usd',
    } = body;

    const amountInCents = Math.round(Number(amount) * 100);
    const feeInCents = Math.round(Number(requestlyFee || 0) * 100);
    const artistNetInCents = body.artistNet
      ? Math.round(Number(body.artistNet) * 100)
      : Math.max(0, amountInCents - feeInCents - Math.round(Number(body.stripeFee || 0) * 100));

    // Invoke Stripe Live API
    if (stripe) {
      const paymentIntentParams = {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        // Song requests place an authorization hold; fan is ONLY charged when band accepts!
        capture_method: isDirectTip ? 'automatic' : 'manual',
        automatic_payment_methods: {
          enabled: true, // Enables Apple Pay, Google Pay, and Credit Cards automatically
        },
        description: isDirectTip
          ? `Direct Musician Tip from ${fanName || 'Fan'}`
          : `Song Request: "${songTitle}" by ${fanName || 'Fan'}`,
        metadata: {
          songTitle: songTitle || '',
          fanName: fanName || 'Anonymous Fan',
          bandId: bandId || '',
          isDirectTip: isDirectTip ? 'true' : 'false',
          requestlyFee: (requestlyFee || 0).toString(),
        },
      };

      // Direct Stripe Connect Split:
      // Band receives 100% of their song price and tip via transfer_data.amount!
      // Requestly platform receives the full platform fee, and Stripe fees are covered transparently by the fan.
      if (bandStripeAccountId && bandStripeAccountId.startsWith('acct_') && !bandStripeAccountId.startsWith('acct_test_')) {
        paymentIntentParams.transfer_data = {
          destination: bandStripeAccountId,
          amount: artistNetInCents,
        };
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          captureMethod: isDirectTip ? 'automatic' : 'manual',
          mode: 'live_stripe',
        }),
      };
    }

    // In demo / test mode without secret key configured:
    const mockIntentId = `pi_${isDirectTip ? 'tip' : 'hold'}_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        clientSecret: `${mockIntentId}_secret_test`,
        paymentIntentId: mockIntentId,
        captureMethod: isDirectTip ? 'automatic' : 'manual',
        mode: 'test_simulation',
      }),
    };
  } catch (err) {
    console.error('Create payment intent error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Payment processing failed',
      }),
    };
  }
};
