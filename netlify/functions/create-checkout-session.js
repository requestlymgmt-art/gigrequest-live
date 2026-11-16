// netlify/functions/create-checkout-session.js
// Handles real-money Stripe Checkout Sessions with Apple Pay, Google Pay, and Stripe Connect transfers
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
    const {
      amount, // Total charged in dollars (e.g. 7.52)
      artistNet = 0, // Band net amount (e.g. 5.00)
      requestlyFee = 0,
      bandStripeAccountId,
      songTitle = 'Song Request',
      songArtist = '',
      fanName = 'Anonymous Fan',
      fanMessage = '',
      songPrice = 0,
      tipAmount = 0,
      fanFee = 0,
      bandId = '',
      slug = 'live',
      origin = 'https://requestly.live',
      currency = 'usd',
      isDirectTip = false,
      requestId = '',
    } = body;

    const amountInCents = Math.round(Number(amount) * 100);
    const feeInCents = Math.round(Number(requestlyFee) * 100);

    // If real Stripe secret key is present in Netlify environment variables:
    if (stripe && process.env.STRIPE_SECRET_KEY) {
      const sessionParams = {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: isDirectTip ? `💖 Musician Tip: ${fanName}` : `Song Request: ${songTitle}`,
                description: isDirectTip
                  ? `Direct tip to the band from ${fanName}`
                  : `Live performance request for "${songTitle}" by ${songArtist || 'Band'}`,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          requestId: requestId || '',
          bandId: bandId || '',
          songTitle: songTitle || '',
          songArtist: songArtist || '',
          fanName: fanName || 'Anonymous Fan',
          fanMessage: fanMessage || '',
          songPrice: (songPrice || 0).toString(),
          tipAmount: (tipAmount || 0).toString(),
          requestlyFee: (requestlyFee || 0).toString(),
          fanFee: (fanFee || 0).toString(),
          totalCharged: (amount || 0).toString(),
          isDirectTip: isDirectTip ? 'true' : 'false',
        },
        payment_intent_data: {
          capture_method: isDirectTip ? 'automatic' : 'manual',
          description: isDirectTip
            ? `Direct Tip from ${fanName}`
            : `Song Request: "${songTitle}" by ${fanName}`,
          metadata: {
            requestId: requestId || '',
            bandId: bandId || '',
            songTitle: songTitle || '',
            fanName: fanName || 'Anonymous Fan',
            isDirectTip: isDirectTip ? 'true' : 'false',
          },
        },
        success_url: `${origin}/live/${slug}?session_id={CHECKOUT_SESSION_ID}&payment_success=true&song=${encodeURIComponent(songTitle)}${requestId ? `&req_id=${requestId}` : ''}${isDirectTip ? '&is_tip=true' : ''}`,
        cancel_url: `${origin}/live/${slug}?payment_cancelled=true${requestId ? `&req_id=${requestId}` : ''}`,
      };

      // Direct payout to band via Stripe Connect if account is linked and ready
      if (bandStripeAccountId && bandStripeAccountId.startsWith('acct_') && !bandStripeAccountId.startsWith('acct_test_')) {
        try {
          const dest = await stripe.accounts.retrieve(bandStripeAccountId);
          if (dest && dest.charges_enabled) {
            sessionParams.payment_intent_data.application_fee_amount = feeInCents;
            sessionParams.payment_intent_data.transfer_data = {
              destination: bandStripeAccountId,
            };
          }
        } catch (e) {
          console.warn('Destination account not ready, funds securely collected in platform account:', e.message);
        }
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
