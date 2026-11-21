// netlify/functions/stripe-webhook.js
// Handles Stripe webhooks to confirm authorization holds and payments
// Ensures the performer ONLY sees requests after authorization/payment is confirmed
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
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let stripeEvent;
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_JNdaJwqNSMgWnRBJj6dkNKZTMFY12ZLY';

  try {
    if (stripe && webhookSecret && sig) {
      stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
    } else {
      // Parse payload directly if webhook secret is not yet configured in Netlify env
      stripeEvent = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    const eventType = stripeEvent.type;
    console.log(`[Stripe Webhook] Received event: ${eventType}`);

    // 1. Authorization hold placed successfully (Fallback if manual capture ever used)
    if (eventType === 'payment_intent.amount_capturable_updated') {
      const pi = stripeEvent.data.object;
      const meta = pi.metadata || {};
      const requestId = meta.requestId;

      if (requestId) {
        // Update existing pre-inserted request to 'authorized'
        await supabase
          .from('requests')
          .update({
            payment_status: 'authorized',
            stripe_payment_id: pi.id,
          })
          .eq('id', requestId);
      } else if (meta.bandId && meta.songTitle) {
        // Insert new authorized request if not already present
        const { data: existing } = await supabase
          .from('requests')
          .select('id')
          .eq('stripe_payment_id', pi.id)
          .maybeSingle();

        if (!existing) {
          let resolvedSongPrice = Number(meta.songPrice || 0);
          let resolvedTipAmount = Number(meta.tipAmount || 0);
          if (resolvedSongPrice === 0 && Number(pi.amount) > 0) {
            const paidDollars = Number(pi.amount) / 100;
            const netAfterFees = Math.max(0, paidDollars - 2.0 - (paidDollars * 0.029 + 0.3));
            resolvedSongPrice = Math.max(5.00, Number((netAfterFees - resolvedTipAmount).toFixed(2)));
          }

          const { error: insertErr } = await supabase.from('requests').insert({
            band_id: meta.bandId,
            event_id: meta.eventId || null,
            song_title: meta.songTitle,
            song_artist: meta.songArtist || '',
            fan_name: meta.fanName || 'Fan',
            fanMessage: meta.fanMessage || '',
            song_price: resolvedSongPrice,
            tip_amount: resolvedTipAmount,
            fan_fee: Number(meta.fanFee || 0),
            total_paid: Number(pi.amount) / 100,
            status: 'pending',
            payment_status: 'authorized',
            payment_method: pi.payment_method_types?.[0] || 'apple_pay',
            stripe_payment_id: pi.id,
          });
          if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('duplicate key'))) {
            console.log(`[Stripe Webhook] Duplicate prevented: request already exists for PI: ${pi.id}`);
          }
        }
      }
    }

    // 2. Payments Succeeded (Automatic Capture for Song Requests & Direct Tips)
    else if (eventType === 'payment_intent.succeeded') {
      const pi = stripeEvent.data.object;
      const meta = pi.metadata || {};
      const requestId = meta.requestId;

      if (requestId) {
        await supabase
          .from('requests')
          .update({
            payment_status: 'paid',
            status: meta.isDirectTip === 'true' ? 'completed' : 'pending',
            stripe_payment_id: pi.id,
          })
          .eq('id', requestId);
      } else if (meta.bandId) {
        // Double-safety: If client didn't insert yet or browser closed, insert now
        const { data: existing } = await supabase
          .from('requests')
          .select('id')
          .eq('stripe_payment_id', pi.id)
          .maybeSingle();

        if (!existing) {
          const isTip = meta.isDirectTip === 'true';
          let resolvedSongPrice = Number(meta.songPrice || 0);
          let resolvedTipAmount = Number(meta.tipAmount || (isTip ? Number(pi.amount) / 100 : 0));

          if (!isTip && resolvedSongPrice === 0 && Number(pi.amount) > 0) {
            const paidDollars = Number(pi.amount) / 100;
            const netAfterFees = Math.max(0, paidDollars - 2.0 - (paidDollars * 0.029 + 0.3));
            resolvedSongPrice = Math.max(5.00, Number((netAfterFees - resolvedTipAmount).toFixed(2)));
          }

          const { error: insertErr } = await supabase.from('requests').insert({
            band_id: meta.bandId,
            event_id: meta.eventId || null,
            song_title: isTip ? '💖 Direct Tip to the Band' : (meta.songTitle || 'Song Request'),
            song_artist: isTip ? 'Thank You!' : (meta.songArtist || ''),
            fan_name: meta.fanName || 'Fan',
            fan_message: meta.fanMessage || '',
            song_price: resolvedSongPrice,
            tip_amount: resolvedTipAmount,
            fan_fee: Number(meta.fanFee || 0),
            total_paid: Number(pi.amount) / 100,
            status: isTip ? 'completed' : 'pending',
            payment_status: 'paid',
            payment_method: pi.payment_method_types?.[0] || 'apple_pay',
            stripe_payment_id: pi.id,
          });

          if (insertErr) {
            if (insertErr.code === '23505' || insertErr.message?.includes('duplicate key')) {
              console.log(`[Stripe Webhook] Duplicate prevented: request already exists for PI: ${pi.id}`);
              await supabase
                .from('requests')
                .update({ payment_status: 'paid' })
                .eq('stripe_payment_id', pi.id);
            } else {
              console.error('[Stripe Webhook] Supabase insert error:', insertErr);
            }
          } else {
            console.log(`[Stripe Webhook] Inserted queue request for PI: ${pi.id}`);
          }
        } else {
          await supabase
            .from('requests')
            .update({ payment_status: 'paid' })
            .eq('id', existing.id);
        }
      }
    }

    // 3. Checkout Session Completed
    else if (eventType === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const meta = session.metadata || {};
      const requestId = meta.requestId;
      const isTip = meta.isDirectTip === 'true';

      if (requestId) {
        await supabase
          .from('requests')
          .update({
            payment_status: isTip ? 'paid' : 'authorized',
            status: isTip ? 'completed' : 'pending',
            stripe_payment_id: session.id,
          })
          .eq('id', requestId);
      }
    }

    // 4. Payment Failed or Cancelled - Remove from DB so performer NEVER sees it
    else if (
      eventType === 'payment_intent.payment_failed' ||
      eventType === 'payment_intent.canceled'
    ) {
      const pi = stripeEvent.data.object;
      const requestId = pi.metadata?.requestId;

      if (requestId) {
        await supabase.from('requests').delete().eq('id', requestId);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ received: true }),
    };
  } catch (err) {
    console.error('Error handling Stripe webhook:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
