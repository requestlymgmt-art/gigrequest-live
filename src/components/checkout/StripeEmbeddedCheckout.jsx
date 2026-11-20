// src/components/checkout/StripeEmbeddedCheckout.jsx
// Embedded Stripe Express Checkout (Apple Pay & Google Pay ONLY) and Native Card Element
// Fast, real-money pre-authorization with zero Link, zero Klarna, zero Amazon Pay
import { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_LIVE_PUBLISHABLE_KEY } from '../../lib/stripe';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';

let stripePromise = null;
async function getStripe() {
  if (stripePromise) return stripePromise;
  let pk = STRIPE_LIVE_PUBLISHABLE_KEY;
  if (!pk) {
    try {
      const res = await fetch('/.netlify/functions/get-stripe-config');
      if (res.ok) {
        const data = await res.json();
        pk = data.publishableKey;
      }
    } catch (e) {
      console.warn('Could not fetch stripe config:', e);
    }
  }
  if (pk) {
    stripePromise = loadStripe(pk);
  }
  return stripePromise;
}

export default function StripeEmbeddedCheckout({
  amount, // Total charged (e.g. 7.52)
  artistNet, // Band take-home (e.g. 5.00)
  requestlyFee = 0,
  fanFee = 0,
  stripeFee = 0,
  tipAmount = 0,
  songPrice = 0,
  songTitle = 'Song Request',
  songArtist = '',
  fanName = '',
  fanMessage = '',
  bandId,
  bandStripeAccountId = '',
  slug = 'live',
  isDirectTip = false,
  eventId = null,
  idempotencyKey = '',
  onSuccess,
  onCancel,
}) {
  const expressContainerRef = useRef(null);
  const cardContainerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [stripeInstance, setStripeInstance] = useState(null);
  const [expressElementsInstance, setExpressElementsInstance] = useState(null);
  const [expressElement, setExpressElement] = useState(null);
  const [cardElement, setCardElement] = useState(null);
  const [hasWallets, setHasWallets] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Refs for concurrency lock & intent reuse per modal action
  const isSubmittingRef = useRef(false);
  const activeIntentRef = useRef(null);

  // Reset activeIntentRef whenever idempotencyKey changes (e.g. fresh request modal session)
  useEffect(() => {
    activeIntentRef.current = null;
  }, [idempotencyKey]);

  // Always keep latest props in a ref for event callbacks
  const propsRef = useRef({
    amount,
    artistNet,
    requestlyFee,
    fanFee,
    stripeFee,
    tipAmount,
    songPrice,
    songTitle,
    songArtist,
    fanName,
    fanMessage,
    bandId,
    bandStripeAccountId,
    slug,
    isDirectTip,
    eventId,
    idempotencyKey,
  });

  useEffect(() => {
    propsRef.current = {
      amount,
      artistNet,
      requestlyFee,
      fanFee,
      stripeFee,
      tipAmount,
      songPrice,
      songTitle,
      songArtist,
      fanName,
      fanMessage,
      bandId,
      bandStripeAccountId,
      slug,
      isDirectTip,
      eventId,
      idempotencyKey,
    };
  });

  const amountInCents = Math.max(50, Math.round(Number(amount) * 100));

  // 1. Initialize Stripe, Express Checkout Element, and Card Element on mount
  useEffect(() => {
    let isMounted = true;
    let expEl = null;
    let crdEl = null;

    async function initStripe() {
      setLoading(true);
      setErrorMessage('');

      try {
        const stripe = await getStripe();
        if (!stripe || !isMounted) return;
        setStripeInstance(stripe);

        // A. Express Checkout instance (Apple Pay & Google Pay ONLY)
        const expElements = stripe.elements({
          mode: 'payment',
          amount: amountInCents,
          currency: 'usd',
          captureMethod: 'automatic',
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#3b82f6',
              colorBackground: '#131826',
              colorText: '#ffffff',
            },
          },
        });
        setExpressElementsInstance(expElements);

        expEl = expElements.create('expressCheckout', {
          paymentMethods: {
            applePay: 'auto',
            googlePay: 'always', // Force Google Pay button to display on Android/Chrome
            link: 'never',
            amazonPay: 'never',
            paypal: 'never',
            klarna: 'never',
          },
          buttonTheme: {
            applePay: 'black',
            googlePay: 'black',
          },
          buttonHeight: 48,
        });

        const checkAvailableWallets = (methods) => {
          if (!isMounted) return;
          if (!methods || Object.keys(methods).length === 0) {
            setHasWallets(false);
            return;
          }
          const hasApple = methods.applePay === true || methods.applePay?.available === true;
          const hasGoogle = methods.googlePay === true || methods.googlePay?.available === true || (methods.googlePay && typeof methods.googlePay === 'object');
          setHasWallets(Boolean(hasApple || hasGoogle));
        };

        expEl.on('availablepaymentmethodschange', (event) => {
          checkAvailableWallets(event?.paymentMethods);
        });

        expEl.on('ready', ({ availablePaymentMethods }) => {
          checkAvailableWallets(availablePaymentMethods);
          if (isMounted) setLoading(false);
        });

        // Confirm via Express Checkout (native Apple Pay double-click & Face ID)
        expEl.on('confirm', async () => {
          if (isSubmittingRef.current) return;
          const p = propsRef.current;

          // Fan Name Validation: Strictly Required for song requests
          if (!p.isDirectTip && (!p.fanName || !p.fanName.trim() || p.fanName.trim().toLowerCase() === 'anonymous fan')) {
            setErrorMessage('Please enter your name or table number above before authorizing.');
            toast.error('Your name or table number is required');
            return;
          }

          isSubmittingRef.current = true;
          setProcessing(true);
          try {
            // 1. Validate & submit elements
            const { error: submitError } = await expElements.submit();
            if (submitError) {
              setErrorMessage(submitError.message || 'Validation failed');
              toast.error(submitError.message || 'Validation failed');
              return;
            }

            // 2. Obtain or Reuse PaymentIntent (Idempotent per modal session)
            let clientSecret = null;
            let paymentIntentId = null;

            if (
              activeIntentRef.current &&
              activeIntentRef.current.idempotencyKey === p.idempotencyKey &&
              activeIntentRef.current.clientSecret
            ) {
              clientSecret = activeIntentRef.current.clientSecret;
              paymentIntentId = activeIntentRef.current.paymentIntentId;
            } else {
              const piRes = await fetch('/.netlify/functions/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  amount: p.amount,
                  artistNet: p.artistNet,
                  requestlyFee: p.requestlyFee,
                  fanFee: p.fanFee,
                  stripeFee: p.stripeFee,
                  bandId: p.bandId,
                  bandStripeAccountId: p.bandStripeAccountId,
                  songTitle: p.songTitle,
                  songArtist: p.songArtist,
                  songPrice: p.songPrice,
                  tipAmount: p.tipAmount,
                  fanName: p.fanName.trim(),
                  fanMessage: p.fanMessage.trim(),
                  isDirectTip: p.isDirectTip,
                  eventId: p.eventId || null,
                  idempotencyKey: p.idempotencyKey || undefined,
                }),
              });

              const piData = await piRes.json();
              if (!piData.success || !piData.clientSecret) {
                throw new Error(piData.error || 'Failed to initialize payment');
              }

              clientSecret = piData.clientSecret;
              paymentIntentId = piData.paymentIntentId;

              if (p.idempotencyKey) {
                activeIntentRef.current = {
                  idempotencyKey: p.idempotencyKey,
                  clientSecret,
                  paymentIntentId,
                };
              }
            }

            // 3. Confirm payment with Stripe (handles native Apple Pay & Google Pay)
            const { error, paymentIntent } = await stripe.confirmPayment({
              elements: expElements,
              clientSecret,
              confirmParams: {
                return_url: `${window.location.origin}/live/${p.slug}?payment_success=true&song=${encodeURIComponent(p.songTitle)}`,
              },
              redirect: 'if_required',
            });

            if (error) {
              setErrorMessage(error.message || 'Payment authorization failed');
              toast.error(error.message || 'Payment failed');
            } else {
              // 4. Save confirmed request in Supabase ONLY after Stripe confirms!
              // Double-check existing to eliminate webhook race duplicate
              const finalStripeId = paymentIntent?.id || paymentIntentId;
              const { data: existing } = await supabase
                .from('requests')
                .select('*')
                .eq('stripe_payment_id', finalStripeId)
                .maybeSingle();

              let finalReq = existing;
              if (!existing) {
                const { data: newReq, error: insertError } = await supabase
                  .from('requests')
                  .insert({
                    band_id: p.bandId,
                    event_id: p.eventId || null,
                    song_title: p.isDirectTip ? '💖 Direct Tip to the Band' : p.songTitle,
                    song_artist: p.isDirectTip ? 'Thank You!' : (p.songArtist || 'Custom Song'),
                    fan_name: p.fanName.trim(),
                    fan_message: p.fanMessage.trim(),
                    song_price: Number(p.songPrice || 0),
                    tip_amount: Number(p.tipAmount || 0),
                    fan_fee: Number(p.fanFee || 0),
                    total_paid: Number(p.amount),
                    status: p.isDirectTip ? 'completed' : 'pending',
                    payment_status: 'paid',
                    payment_method: paymentIntent?.payment_method_types?.[0] || 'apple_pay',
                    stripe_payment_id: finalStripeId,
                  })
                  .select()
                  .maybeSingle();

                if (insertError) {
                  // Handled by webhook or unique constraint
                  const { data: refetched } = await supabase
                    .from('requests')
                    .select('*')
                    .eq('stripe_payment_id', finalStripeId)
                    .maybeSingle();
                  finalReq = refetched;
                } else {
                  finalReq = newReq;
                }
              }

              activeIntentRef.current = null;
              const walletType = paymentIntent?.charges?.data?.[0]?.payment_method_details?.card?.wallet?.type ||
                paymentIntent?.payment_method_types?.[0] || 'express_wallet';
              const walletLabel = walletType.includes('google') ? 'Google Pay' : 'Apple Pay';

              confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
              toast.success(`🎉 Payment completed with ${walletLabel}!`);
              if (onSuccess) onSuccess(finalReq);
            }
          } catch (err) {
            console.error('Express Checkout error:', err);
            setErrorMessage(err.message || 'Payment failed');
            toast.error(err.message || 'Payment failed');
          } finally {
            isSubmittingRef.current = false;
            if (isMounted) setProcessing(false);
          }
        });

        // B. Dedicated Card Element instance
        const cardElements = stripe.elements();
        crdEl = cardElements.create('card', {
          style: {
            base: {
              color: '#ffffff',
              fontSize: '16px',
              fontFamily: 'Inter, system-ui, sans-serif',
              iconColor: '#60a5fa',
              '::placeholder': {
                color: '#64748b',
              },
            },
            invalid: {
              color: '#ef4444',
              iconColor: '#ef4444',
            },
          },
          hidePostalCode: false,
        });

        crdEl.on('change', (event) => {
          if (isMounted) {
            if (event.error) {
              setErrorMessage(event.error.message);
            } else {
              setErrorMessage('');
            }
          }
        });

        setExpressElement(expEl);
        setCardElement(crdEl);
        if (isMounted) setLoading(false);
      } catch (err) {
        console.error('Stripe Elements initialization error:', err);
        if (isMounted) {
          setErrorMessage('Unable to load payment elements. Please refresh.');
          setLoading(false);
        }
      }
    }

    initStripe();

    return () => {
      isMounted = false;
      if (expEl) {
        try { expEl.destroy(); } catch (e) {}
      }
      if (crdEl) {
        try { crdEl.destroy(); } catch (e) {}
      }
    };
  }, []);

  // 2. Mount Express Checkout into DOM once element & container are ready
  useEffect(() => {
    if (expressElement && expressContainerRef.current) {
      try {
        expressContainerRef.current.innerHTML = '';
        expressElement.mount(expressContainerRef.current);
      } catch (e) {
        console.warn('Express mount error:', e);
      }
    }
  }, [expressElement]);

  // 3. Mount Card Element into DOM once element & container are ready
  // This guarantees the card input mounts IMMEDIATELY on open (even with 0 tip!)
  useEffect(() => {
    if (cardElement && cardContainerRef.current) {
      try {
        cardContainerRef.current.innerHTML = '';
        cardElement.mount(cardContainerRef.current);
      } catch (e) {
        console.warn('Card mount error:', e);
      }
    }
  }, [cardElement]);

  // 4. Update Express Checkout amount dynamically when user changes tip
  useEffect(() => {
    if (expressElementsInstance && amountInCents) {
      try {
        expressElementsInstance.update({ amount: amountInCents });
      } catch (e) {
        console.warn('Could not update express amount:', e);
      }
    }
  }, [amountInCents, expressElementsInstance]);

  // 5. Handle Card Form Submission
  const handleCardSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || processing) return;
    if (!stripeInstance || !cardElement) return;

    const p = propsRef.current;

    // Fan Name Validation: Strictly Required for song requests
    if (!p.isDirectTip && (!p.fanName || !p.fanName.trim() || p.fanName.trim().toLowerCase() === 'anonymous fan')) {
      setErrorMessage('Please enter your name or table number above before sending your request.');
      toast.error('Your name or table number is required');
      const nameInput = document.querySelector('input[placeholder*="Jessica"]');
      if (nameInput) {
        nameInput.focus();
        nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    isSubmittingRef.current = true;
    setProcessing(true);
    setErrorMessage('');

    try {
      // 1. Obtain or Reuse PaymentIntent (Idempotent per modal session)
      // If card payment failed on missing zip code, retrying reuses this exact PaymentIntent
      let clientSecret = null;
      let paymentIntentId = null;

      if (
        activeIntentRef.current &&
        activeIntentRef.current.idempotencyKey === p.idempotencyKey &&
        activeIntentRef.current.clientSecret
      ) {
        clientSecret = activeIntentRef.current.clientSecret;
        paymentIntentId = activeIntentRef.current.paymentIntentId;
      } else {
        const piRes = await fetch('/.netlify/functions/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: p.amount,
            artistNet: p.artistNet,
            requestlyFee: p.requestlyFee,
            fanFee: p.fanFee,
            stripeFee: p.stripeFee,
            bandId: p.bandId,
            bandStripeAccountId: p.bandStripeAccountId,
            songTitle: p.songTitle,
            songArtist: p.songArtist,
            fanName: p.fanName.trim(),
            fanMessage: p.fanMessage.trim(),
            isDirectTip: p.isDirectTip,
            eventId: p.eventId || null,
            idempotencyKey: p.idempotencyKey || undefined,
          }),
        });

        const piData = await piRes.json();
        if (!piData.success || !piData.clientSecret) {
          throw new Error(piData.error || 'Failed to initialize payment');
        }

        clientSecret = piData.clientSecret;
        paymentIntentId = piData.paymentIntentId;

        if (p.idempotencyKey) {
          activeIntentRef.current = {
            idempotencyKey: p.idempotencyKey,
            clientSecret,
            paymentIntentId,
          };
        }
      }

      // 2. Confirm card payment with pre-authorized hold (or direct capture for tip)
      const { error, paymentIntent } = await stripeInstance.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: p.fanName.trim() || undefined,
            },
          },
        }
      );

      if (error) {
        // Android missing zip code or card declined error:
        // Set error message, re-enable button, and keep activeIntentRef so retry reuses this PaymentIntent
        setErrorMessage(error.message || 'Card authorization failed');
        toast.error(error.message || 'Card payment failed');
      } else if (
        paymentIntent &&
        (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')
      ) {
        // Confirmed! Deduplicate against webhook before inserting into Supabase
        const finalStripeId = paymentIntent.id;
        const { data: existing } = await supabase
          .from('requests')
          .select('*')
          .eq('stripe_payment_id', finalStripeId)
          .maybeSingle();

        let finalReq = existing;
        if (!existing) {
          const { data: newReq, error: insertError } = await supabase
            .from('requests')
            .insert({
              band_id: p.bandId,
              event_id: p.eventId || null,
              song_title: p.isDirectTip ? '💖 Direct Tip to the Band' : p.songTitle,
              song_artist: p.isDirectTip ? 'Thank You!' : (p.songArtist || 'Custom Song'),
              fan_name: p.fanName.trim(),
              fan_message: p.fanMessage.trim(),
              song_price: Number(p.songPrice || 0),
              tip_amount: Number(p.tipAmount || 0),
              fan_fee: Number(p.fanFee || 0),
              total_paid: Number(p.amount),
              status: p.isDirectTip ? 'completed' : 'pending',
              payment_status: 'paid',
              payment_method: 'card',
              stripe_payment_id: finalStripeId,
            })
            .select()
            .maybeSingle();

          if (insertError) {
            // Handled by webhook or unique constraint
            const { data: refetched } = await supabase
              .from('requests')
              .select('*')
              .eq('stripe_payment_id', finalStripeId)
              .maybeSingle();
            finalReq = refetched;
          } else {
            finalReq = newReq;
          }
        }

        activeIntentRef.current = null;
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        toast.success(
          p.isDirectTip
            ? '🎉 Tip sent successfully to the band!'
            : '🎉 Song request submitted & sent to the stage!'
        );
        if (onSuccess) onSuccess(finalReq);
      }
    } catch (err) {
      console.error('Card submit error:', err);
      setErrorMessage(err.message || 'Payment failed');
      toast.error(err.message || 'Payment failed');
    } finally {
      isSubmittingRef.current = false;
      setProcessing(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Loading state indicator */}
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          padding: '1.25rem',
          color: 'var(--text-muted)',
          fontSize: '0.85rem'
        }}>
          <RefreshCw size={16} className="spin" color="#3b82f6" />
          <span>Connecting to Apple Pay, Google Pay & secure checkout...</span>
        </div>
      )}

      {errorMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#f87171',
          padding: '0.65rem 0.85rem',
          borderRadius: '8px',
          fontSize: '0.82rem',
          marginBottom: '1rem',
          lineHeight: 1.4
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Native Apple Pay & Google Pay (Express Checkout) */}
      <div style={{
        display: (!loading && hasWallets) ? 'block' : 'none',
        marginBottom: hasWallets ? '0.75rem' : '0',
        height: hasWallets ? 'auto' : 0,
        overflow: 'hidden',
      }}>
        <div
          ref={expressContainerRef}
          style={{ minHeight: hasWallets ? '48px' : '0' }}
        />
      </div>

      {/* 2. "OR PAY WITH CARD" Divider — Only rendered when a wallet is genuinely present */}
      {hasWallets && !loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          margin: '0.85rem 0',
          gap: '0.75rem'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
          <span style={{
            color: 'var(--text-dim)',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Or Pay with Card
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
        </div>
      )}

      {/* 3. Dedicated Card Element Input Box — ALWAYS IN DOM */}
      <div style={{
        display: loading ? 'none' : 'block',
        marginBottom: '0.85rem'
      }}>
        <div style={{
          background: '#131826',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '10px',
          padding: '13px 14px',
          marginBottom: '0.85rem',
          boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.35)'
        }}>
          <div ref={cardContainerRef} style={{ minHeight: '22px' }} />
        </div>

        <button
          type="button"
          disabled={processing}
          onClick={handleCardSubmit}
          className="btn btn-primary btn-lg"
          style={{
            width: '100%',
            fontWeight: 700,
            fontSize: '1rem',
            padding: '0.85rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            opacity: processing ? 0.65 : 1,
            cursor: processing ? 'not-allowed' : 'pointer',
            pointerEvents: processing ? 'none' : 'auto',
            transition: 'all 0.15s ease'
          }}
        >
          {processing ? (
            <>
              <RefreshCw size={16} className="spin" />
              <span>Authorizing Card...</span>
            </>
          ) : (
            <>
              <CreditCard size={17} />
              <span>
                {isDirectTip
                  ? `Tip $${Number(amount).toFixed(2)} with Card`
                  : `Authorize $${Number(amount).toFixed(2)} & Send Request`}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Security Trust Note */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
        fontSize: '0.74rem',
        color: 'var(--text-dim)',
        marginTop: '0.85rem',
        textAlign: 'center'
      }}>
        <ShieldCheck size={14} color="#10b981" />
        <span>
          {isDirectTip
            ? '🔒 256-Bit SSL Encrypted • Direct Musician Payout'
            : '🔒 256-Bit SSL Encrypted • Zero-Risk Pre-Authorized Hold'}
        </span>
      </div>
    </div>
  );
}
