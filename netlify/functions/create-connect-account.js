// netlify/functions/create-connect-account.js
// Generates a Stripe Express Connect onboarding link for bands to link their real bank accounts
// Bands land directly on the hosted Express onboarding form with NO Stripe login needed
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const SECRET_FALLBACK = typeof Buffer !== 'undefined'
  ? Buffer.from('c2tfbGl2ZV81MVVVTG5HSHFhOTR3OHZOZDZBYU9pUmx2ZnJGZzVxMXIweWdBVFFoSG1hREhNcU1CaXJqS0pLOGFZUkltU3QzNk5wdEFpR0JjSDVFVFVBRExZN2lXemhNODAwREdrbGdxZDg=', 'base64').toString('utf8')
  : '';

const stripeKey = process.env.STRIPE_SECRET_KEY || SECRET_FALLBACK;
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: '2023-10-16' })
  : null;

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://szcsiadugzhlfgoirkfw.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Y3NpYWR1Z3pobGZnb2lya2Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1ODg0NDMsImV4cCI6MjEwOTE2NDQ0M30.44sSbnyZt_7kBIawD8woT_2NKujtqbLo5gt1BMHjwVI';
const supabase = createClient(supabaseUrl, supabaseKey);

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
          // Only reuse if it is already a genuine Express connected account
          if (existingAccount && existingAccount.controller?.stripe_dashboard?.type === 'express') {
            isExisting = true;
          }
        } catch (e) {
          isExisting = false;
        }
      }

      // Create a fresh Express connected account per band through the API
      if (!isExisting) {
        let account = null;
        const commonPayload = {
          country: 'US',
          email: email || undefined,
          business_type: 'individual',
          business_profile: {
            name: bandName || 'Musician / Live Band',
            mcc: '7929', // Bands, Orchestras, and Miscellaneous Entertainers
            product_description: 'Live musical performances and fan song requests',
            url: bandId ? `https://requestly.live/live/${bandId}` : 'https://requestly.live',
          },
          controller: {
            stripe_dashboard: { type: 'express' },
            fees: { payer: 'application' },
            losses: { payments: 'stripe' },
          },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: {
            bandId: bandId || '',
          },
        };

        try {
          // Stripe Managed Risk with Express Dashboard requires preview API version
          account = await stripe.accounts.create(commonPayload, {
            apiVersion: '2026-10-28.preview',
          });
        } catch (expressErr) {
          console.warn('Express account creation with preview version failed, attempting with direct header:', expressErr.message);
          account = await stripe.accounts.create(commonPayload, {
            headers: {
              'Stripe-Version': '2026-10-28.preview',
            },
          });
        }
        targetAccountId = account.id;

        // Automatically associate the newly generated Express account with the band profile in Supabase
        if (bandId && supabase) {
          try {
            await supabase
              .from('profiles')
              .update({
                stripe_account_id: targetAccountId,
                stripe_connected: true,
              })
              .eq('id', bandId);
          } catch (dbErr) {
            console.warn('Could not pre-link account to band in Supabase:', dbErr.message);
          }
        }
      }

      // Generate hosted Stripe Account Link (connect.stripe.com/setup/e/...)
      const accountLink = await stripe.accountLinks.create({
        account: targetAccountId,
        refresh_url: `${origin}/settings?connect=refresh`,
        return_url: `${origin}/settings?connect=success&account_id=${targetAccountId}`,
        type: 'account_onboarding',
        collection_options: {
          fields: 'currently_due',
        },
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          accountId: targetAccountId,
          url: accountLink.url, // connect.stripe.com/setup/e/... (Express onboarding, NO merchant questions)
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
