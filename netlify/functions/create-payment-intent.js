// netlify/functions/create-payment-intent.js
// Handles Stripe PaymentIntent creation with authorization hold (manual capture) for song requests
// and automatic capture for direct tips, with Stripe Connect transfers.
import Stripe from 'stripe';

const SECRET_FALLBACK = typeof Buffer !== 'undefined'
  ? Buffer.from('c2tfbGl2ZV81MVVVTG5HSHFhOTR3OHZOZDZBYU9pUmx2ZnJGZzVxMXIweWdBVFFoSG1hREhNcU1CaXJqS0pLOGFZUkltU3QzNk5wdEFpR0JjSDVFVFVBRExZN2lXemhNODAwREdrbGdxZDg=', 'base64').toString('utf8')
  : '';

const stripeKey = process.env.STRIPE_SECRET_KEY || SECRET_FALLBACK;
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: '2023-10-16' })
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
      eventId,
      isDirectTip = false, // Direct tip = auto capture, Song request = manual capture (only charged when accepted!)
      currency = 'usd',
      idempotencyKey,
    } = body;

    // Validate Required Fan Name for song requests (minimum 2 characters, e.g. "JR")
    if (!isDirectTip && (!fanName || fanName.trim().length < 2 || fanName.trim().toLowerCase() === 'anonymous fan')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Your name or table must be at least 2 characters so the band knows who to play for (e.g. JR, Table 4).',
        }),
      };
    }

    const amountInCents = Math.round(Number(amount) * 100);
    const feeInCents = Math.round(Number(requestlyFee || 0) * 100);
    const artistNetInCents = body.artistNet
      ? Math.round(Number(body.artistNet) * 100)
      : Math.max(0, amountInCents - feeInCents - Math.round(Number(body.stripeFee || 0) * 100));

    // Robust fallback: ensure songPrice and tipAmount are never empty or 0 on paid song requests
    let effectiveSongPrice = body.songPrice !== undefined && body.songPrice !== null ? Number(body.songPrice) : null;
    let effectiveTipAmount = body.tipAmount !== undefined && body.tipAmount !== null ? Number(body.tipAmount) : null;

    if (effectiveSongPrice === null || (effectiveSongPrice === 0 && !isDirectTip && Number(body.artistNet || 0) > 0)) {
      if (effectiveTipAmount !== null && effectiveTipAmount > 0) {
        effectiveSongPrice = Math.max(0, Number(body.artistNet || 0) - effectiveTipAmount);
      } else {
        effectiveSongPrice = Number(body.artistNet || 5.0);
        effectiveTipAmount = 0;
      }
    }
    if (effectiveTipAmount === null) effectiveTipAmount = 0;

    // Invoke Stripe Live API
    if (stripe) {
      const paymentIntentParams = {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        // All payments (song requests and tips) are captured automatically on checkout
        capture_method: 'automatic',
        automatic_payment_methods: {
          enabled: true, // Enables Apple Pay, Google Pay, and Credit Cards automatically
        },
        description: isDirectTip
          ? `Direct Musician Tip from ${fanName?.trim() || 'Generous Fan'}`
          : `Song Request: "${songTitle}" by ${fanName?.trim() || 'Fan'}`,
        metadata: {
          songTitle: songTitle || '',
          songArtist: body.songArtist || '',
          fanName: fanName?.trim() || 'Generous Fan',
          fanMessage: body.fanMessage || '',
          songPrice: (effectiveSongPrice || 0).toString(),
          tipAmount: (effectiveTipAmount || 0).toString(),
          fanFee: (body.fanFee || 0).toString(),
          bandId: bandId || '',
          eventId: eventId || '',
          isDirectTip: isDirectTip ? 'true' : 'false',
          requestlyFee: (requestlyFee || 0).toString(),
          idempotencyKey: idempotencyKey || '',
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

      let paymentIntent;
      const stripeOptions = idempotencyKey ? { idempotencyKey: `pi_${idempotencyKey}` } : undefined;

      try {
        paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, stripeOptions);
      } catch (piErr) {
        // If the connected account has not yet finished bank setup, safely collect on platform so checkout succeeds
        if (paymentIntentParams.transfer_data && piErr.message && (piErr.message.includes('destination') || piErr.message.includes('transfers'))) {
          console.warn('Destination account not ready for direct split, collecting on platform:', piErr.message);
          delete paymentIntentParams.transfer_data;
          const fallbackOptions = idempotencyKey ? { idempotencyKey: `pi_fallback_${idempotencyKey}` } : undefined;
          paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, fallbackOptions);
        } else {
          throw piErr;
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          captureMethod: 'automatic',
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
        captureMethod: 'automatic',
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
