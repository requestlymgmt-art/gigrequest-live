// netlify/functions/create-connect-account.js
// Generates a Stripe Express Connect onboarding link for bands to link their real bank accounts
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

  try {
    const body = JSON.parse(event.body || '{}');
    const { bandId, bandName, email, accountId: incomingAccountId, returnUrl } = body;
    const origin = returnUrl || 'https://fluffy-swan-6c20ad.netlify.app';

    if (stripe && process.env.STRIPE_SECRET_KEY) {
      let targetAccountId = incomingAccountId;
      let isExisting = false;

      // If incoming account is a real Stripe account ID (not a mock acct_test_), check if it exists
      if (targetAccountId && !targetAccountId.startsWith('acct_test_')) {
        try {
          const existingAccount = await stripe.accounts.retrieve(targetAccountId);
          if (existingAccount && existingAccount.id) {
            isExisting = true;
            // If already fully onboarded with bank details, generate Express Dashboard login link
            if (existingAccount.details_submitted) {
              const loginLink = await stripe.accounts.createLoginLink(targetAccountId);
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                  success: true,
                  accountId: targetAccountId,
                  url: loginLink.url,
                  mode: 'live_stripe_dashboard',
                  message: 'Redirecting to Stripe Express Dashboard to update bank details.',
                }),
              };
            }
          }
        } catch (e) {
          // If retrieval failed, create a fresh account
          isExisting = false;
        }
      }

      // If no valid real account exists yet (or if previous was a practice acct_test_), create a new real Express account
      if (!isExisting) {
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
          settings: {
            payouts: {
              schedule: {
                interval: 'daily',
                delay_days: 2, // Standard 2-business-day rolling bank payouts
              },
            },
          },
          metadata: {
            bandId: bandId || '',
          },
        });
        targetAccountId = account.id;
      }

      // Generate standard Stripe Express Account Link for entering bank details
      const accountLink = await stripe.accountLinks.create({
        account: targetAccountId,
        refresh_url: `${origin}/settings?connect=refresh`,
        return_url: `${origin}/settings?connect=success&account_id=${targetAccountId}`,
        type: 'account_onboarding',
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          accountId: targetAccountId,
          url: accountLink.url,
          mode: 'live_stripe',
        }),
      };
    }

    // When STRIPE_SECRET_KEY is not yet added in Netlify environment variables:
    const testAccountId = incomingAccountId && incomingAccountId.startsWith('acct_test_')
      ? incomingAccountId
      : `acct_test_${Math.random().toString(36).substring(2, 10)}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        requiresLiveKey: true,
        accountId: testAccountId,
        url: null,
        mode: 'test_simulation',
        message: 'Stripe Connect live bank onboarding requires STRIPE_SECRET_KEY in Netlify settings.',
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
