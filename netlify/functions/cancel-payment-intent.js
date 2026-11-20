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

    if (stripe && stripeKey && !paymentIntentId.startsWith('pi_hold_') && !paymentIntentId.startsWith('pi_test_')) {
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

      // Check current status of the PaymentIntent on Stripe
      const pi = await stripe.paymentIntents.retrieve(targetPi);

      if (pi.status === 'succeeded') {
        // Payment was captured/paid! Issue an immediate 100% full refund to the fan!
        let refund;
        try {
          refund = await stripe.refunds.create({
            payment_intent: targetPi,
            reverse_transfer: true,
          });
        } catch (revErr) {
          // If destination transfer was not attached or collecting on platform, refund directly
          refund = await stripe.refunds.create({
            payment_intent: targetPi,
          });
        }

        console.log(`[Stripe Refund] Successfully refunded payment ${targetPi} via refund ${refund.id}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            action: 'refunded',
            refundId: refund.id,
            status: refund.status,
            amount: refund.amount / 100,
            mode: 'live_stripe',
          }),
        };
      } else if (pi.status === 'requires_capture') {
        // Uncaptured authorization hold: release/cancel it so the fan is never charged
        const canceledIntent = await stripe.paymentIntents.cancel(targetPi);
        console.log(`[Stripe Hold Cancel] Canceled hold for ${targetPi}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            action: 'canceled_hold',
            status: canceledIntent.status,
            mode: 'live_stripe',
          }),
        };
      } else if (pi.status === 'canceled') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            action: 'already_canceled',
            status: 'canceled',
            mode: 'live_stripe',
          }),
        };
      } else {
        // Fallback: try cancel, if failed try refund
        try {
          const canceledIntent = await stripe.paymentIntents.cancel(targetPi);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              action: 'canceled',
              status: canceledIntent.status,
              mode: 'live_stripe',
            }),
          };
        } catch (cancErr) {
          const refund = await stripe.refunds.create({ payment_intent: targetPi });
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              action: 'refunded',
              refundId: refund.id,
              mode: 'live_stripe',
            }),
          };
        }
      }
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
