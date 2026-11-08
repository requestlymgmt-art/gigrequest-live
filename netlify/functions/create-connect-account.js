// netlify/functions/create-connect-account.js
// Generates a Stripe Express Connect onboarding link for bands to link their bank accounts

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
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { bandId, bandName, email, returnUrl } = body;

    if (stripe && process.env.STRIPE_SECRET_KEY) {
      // 1. Create standard Stripe Express account for the band
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: email || undefined,
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
        },
        business_profile: {
          name: bandName || 'Musician / Live Band',
          mcc: '7929', // Bands, Orchestras, and Miscellaneous Entertainers
        },
        metadata: {
          bandId: bandId || '',
        },
      });

      // 2. Generate Account Link for bank onboarding
      const origin = returnUrl || 'https://fluffy-swan-6c20ad.netlify.app';
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${origin}/settings?connect=refresh`,
        return_url: `${origin}/settings?connect=success&account_id=${account.id}`,
        type: 'account_onboarding',
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          accountId: account.id,
          url: accountLink.url,
          mode: 'live_stripe',
        }),
      };
    }

    // In test mode without live keys:
    // Generate verified test connect account ID
    const testAccountId = `acct_test_${Math.random().toString(36).substring(2, 10)}`;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        accountId: testAccountId,
        url: null,
        mode: 'test_simulation',
        message: 'Stripe Connect simulation ready. Add STRIPE_SECRET_KEY for live onboarding.',
      }),
    };
  } catch (err) {
    console.error('Stripe Connect creation error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Failed to create Connect account',
      }),
    };
  }
};
