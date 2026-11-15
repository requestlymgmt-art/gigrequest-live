// netlify/functions/create-connect-account.js
// Generates a Stripe Express Connect onboarding link for bands to link their real bank accounts
// Bands land directly on the hosted Express onboarding form with NO Stripe login needed
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
    const origin = returnUrl || 'https://requestly.live';

    if (stripe) {
      let targetAccountId = incomingAccountId;
      let isExisting = false;

      // Check if incoming account is an existing Express account (and not our master platform account)
      if (
        targetAccountId &&
        !targetAccountId.startsWith('acct_test_') &&
        targetAccountId !== 'acct_1UULnGHqa94w8vNd'
      ) {
        try {
          const existingAccount = await stripe.accounts.retrieve(targetAccountId);
          if (existingAccount && existingAccount.id) {
            isExisting = true;
          }
        } catch (e) {
          isExisting = false;
        }
      }

      // Create a fresh Express account per band through the API
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
            product_description: 'Live musical performances and fan song requests',
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

      // Generate hosted Stripe Express Account Link (NO Stripe login needed)
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
          url: accountLink.url, // connect.stripe.com/setup/s/... (NO login needed)
          mode: 'live_stripe',
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Stripe configuration missing',
      }),
    };
  } catch (err) {
    console.error('Stripe Connect creation error:', err);

    // When Stripe requires platform profile questionnaire to be completed
    const isProfileNotice = err.message && err.message.includes('platform profile');
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        needsPlatformProfile: isProfileNotice,
        ownerDashboardUrl: 'https://dashboard.stripe.com/connect/accounts/overview',
        error: isProfileNotice
          ? 'Platform Profile Required: Please log into your Stripe Dashboard at dashboard.stripe.com/connect/accounts/overview to answer the 1-minute Connect questionnaire. Once submitted, 1-click Express onboarding without login will activate for all bands.'
          : (err.message || 'Failed to create Connect account'),
      }),
    };
  }
};
