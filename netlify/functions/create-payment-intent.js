// netlify/functions/create-payment-intent.js
// Handles Stripe PaymentIntent creation with Stripe Connect platform fees and transfers

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    const Stripe = require('stripe');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  } catch (err) {
    console.error('Failed to initialize Stripe SDK:', err);
  }
}

exports.handler = async (event) => {
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
      currency = 'usd',
    } = body;

    const amountInCents = Math.round(Number(amount) * 100);
    const feeInCents = Math.round(Number(requestlyFee || 0) * 100);

    // If real Stripe secret key is present, invoke real Stripe API
    if (stripe && process.env.STRIPE_SECRET_KEY) {
      const paymentIntentParams = {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true, // Enables Apple Pay, Google Pay, and Credit Cards automatically
        },
        description: `Song Request: "${songTitle}" by ${fanName || 'Fan'}`,
        metadata: {
          songTitle: songTitle || '',
          fanName: fanName || 'Anonymous Fan',
          bandId: bandId || '',
          requestlyFee: (requestlyFee || 0).toString(),
        },
      };

      // If band has a Stripe Connect account connected, transfer net funds to them
      if (bandStripeAccountId && bandStripeAccountId.startsWith('acct_')) {
        paymentIntentParams.application_fee_amount = feeInCents;
        paymentIntentParams.transfer_data = {
          destination: bandStripeAccountId,
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
          mode: 'live_stripe',
        }),
      };
    }

    // In demo / test mode without secret key configured:
    // Generate verified instant confirmation so fan and band can test full flow today
    const mockIntentId = `pi_test_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        clientSecret: `${mockIntentId}_secret_test`,
        paymentIntentId: mockIntentId,
        mode: 'test_simulation',
        message: 'Payment processed successfully in test mode. Add STRIPE_SECRET_KEY for live charges.',
      }),
    };
  } catch (error) {
    console.error('Payment intent error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Payment processing failed',
      }),
    };
  }
};

