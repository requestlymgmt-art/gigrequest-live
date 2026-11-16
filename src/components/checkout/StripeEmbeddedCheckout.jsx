// src/components/checkout/StripeEmbeddedCheckout.jsx
// Embedded Stripe Express Checkout (Apple Pay & Google Pay) and Payment Element (Cards)
// Brings up native Apple Pay double-click & Face ID sheet directly on requestly.live without redirecting
import { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_LIVE_PUBLISHABLE_KEY } from '../../lib/stripe';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
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
  onSuccess,
  onCancel,
}) {
  const expressContainerRef = useRef(null);
  const paymentContainerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [stripeInstance, setStripeInstance] = useState(null);
  const [elementsInstance, setElementsInstance] = useState(null);
  const [hasWallets, setHasWallets] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
    };
  });

  const amountInCents = Math.max(50, Math.round(Number(amount) * 100));

  useEffect(() => {
    let isMounted = true;
    let expressElement = null;
    let paymentElement = null;

    async function initStripeElements() {
      setLoading(true);
      setErrorMessage('');

      try {
        const stripe = await getStripe();
        if (!stripe || !isMounted) return;
        setStripeInstance(stripe);

        // Deferred elements instance with pre-authorization hold
        const elements = stripe.elements({
          mode: 'payment',
          amount: amountInCents,
          currency: 'usd',
          captureMethod: isDirectTip ? 'automatic' : 'manual',
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#3b82f6',
              colorBackground: '#131826',
              colorText: '#ffffff',
              colorDanger: '#ef4444',
              fontFamily: 'Inter, system-ui, sans-serif',
              borderRadius: '10px',
              spacingUnit: '4px',
            },
            rules: {
              '.Input': {
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: 'none',
              },
              '.Input:focus': {
                border: '1px solid #3b82f6',
                boxShadow: '0 0 0 1px #3b82f6',
              },
            },
          },
        });
        setElementsInstance(elements);

        // 1. Mount Express Checkout Element (Apple Pay & Google Pay)
        if (expressContainerRef.current) {
          expressContainerRef.current.innerHTML = '';
          expressElement = elements.create('expressCheckout', {
            buttonTheme: {
              applePay: 'black',
              googlePay: 'black',
            },
            buttonType: {
              applePay: 'check-out',
              googlePay: 'pay',
            },
            buttonHeight: 48,
            layout: {
              maxColumns: 1,
              maxRows: 1,
            },
          });

          expressElement.on('ready', ({ availablePaymentMethods }) => {
            if (isMounted) {
              const available = !!(
                availablePaymentMethods?.applePay ||
                availablePaymentMethods?.googlePay ||
                availablePaymentMethods?.link
              );
              setHasWallets(available);
              if (!available) {
                // If Apple Pay / Google Pay isn't available on this device, auto-show card form
                setShowCardForm(true);
              }
            }
          });

          // Confirm via Express Checkout (native Apple Pay double-click & Face ID)
          expressElement.on('confirm', async (event) => {
            setProcessing(true);
            const p = propsRef.current;
            try {
              // 1. Create PaymentIntent on server with metadata and authorization hold
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
                  fanName: p.fanName.trim() || 'Anonymous Fan',
                  fanMessage: p.fanMessage.trim(),
                  isDirectTip: p.isDirectTip,
                  eventId: p.eventId || null,
                }),
              });

              const piData = await piRes.json();
              if (!piData.success || !piData.clientSecret) {
                throw new Error(piData.error || 'Failed to initialize payment');
              }

              // 2. Confirm payment in-place without redirecting
              const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                clientSecret: piData.clientSecret,
                confirmParams: {
                  return_url: `${window.location.origin}/live/${p.slug}?payment_success=true&song=${encodeURIComponent(p.songTitle)}`,
                },
                redirect: 'if_required',
              });

              if (error) {
                event.complete('fail');
                setErrorMessage(error.message || 'Payment authorization failed');
                toast.error(error.message || 'Payment failed');
              } else {
                event.complete('success');
                // Succeeded! Insert confirmed request into Supabase
                const { data: newReq } = await supabase
                  .from('requests')
                  .insert({
                    band_id: p.bandId,
                    event_id: p.eventId || null,
                    song_title: p.isDirectTip ? '💖 Direct Tip to the Band' : p.songTitle,
                    song_artist: p.isDirectTip ? 'Thank You!' : (p.songArtist || 'Custom Song'),
                    fan_name: p.fanName.trim() || 'Anonymous Fan',
                    fan_message: p.fanMessage.trim(),
                    song_price: Number(p.songPrice || 0),
                    tip_amount: Number(p.tipAmount || 0),
                    fan_fee: Number(p.fanFee || 0),
                    total_paid: Number(p.amount),
                    status: p.isDirectTip ? 'completed' : 'pending',
                    payment_status: p.isDirectTip ? 'paid' : 'authorized', // Confirmed hold!
                    payment_method: paymentIntent?.payment_method_types?.[0] || 'apple_pay',
                    stripe_payment_id: paymentIntent?.id || piData.paymentIntentId,
                  })
                  .select()
                  .single();

                if (onSuccess) onSuccess(newReq);
              }
            } catch (err) {
              console.error('Express Checkout error:', err);
              event.complete('fail');
              setErrorMessage(err.message || 'Payment failed');
              toast.error(err.message || 'Payment failed');
            } finally {
              if (isMounted) setProcessing(false);
            }
          });

          expressElement.mount(expressContainerRef.current);
        }

        // 2. Mount Payment Element (Card Entry)
        if (paymentContainerRef.current) {
          paymentContainerRef.current.innerHTML = '';
          paymentElement = elements.create('payment', {
            layout: 'accordion',
            defaultValues: {
              billingDetails: {
                name: fanName || undefined,
              },
            },
          });
          paymentElement.mount(paymentContainerRef.current);
        }

        if (isMounted) setLoading(false);
      } catch (err) {
        console.error('Stripe Elements initialization error:', err);
        if (isMounted) {
          setErrorMessage('Unable to load payment elements. Please refresh.');
          setLoading(false);
        }
      }
    }

    initStripeElements();

    return () => {
      isMounted = false;
      if (expressElement) {
        try { expressElement.destroy(); } catch (e) {}
      }
      if (paymentElement) {
        try { paymentElement.destroy(); } catch (e) {}
      }
    };
  }, [amountInCents, isDirectTip]);

  // Handle Card Form submission
  const handleCardSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!stripeInstance || !elementsInstance) return;

    setProcessing(true);
    setErrorMessage('');
    const p = propsRef.current;

    try {
      // 1. Submit Elements to validate form fields
      const { error: submitError } = await elementsInstance.submit();
      if (submitError) {
        setErrorMessage(submitError.message);
        setProcessing(false);
        return;
      }

      // 2. Create PaymentIntent on server
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
          fanName: p.fanName.trim() || 'Anonymous Fan',
          fanMessage: p.fanMessage.trim(),
          isDirectTip: p.isDirectTip,
          eventId: p.eventId || null,
        }),
      });

      const piData = await piRes.json();
      if (!piData.success || !piData.clientSecret) {
        throw new Error(piData.error || 'Failed to initialize payment');
      }

      // 3. Confirm card payment with pre-authorized hold
      const { error, paymentIntent } = await stripeInstance.confirmPayment({
        elements: elementsInstance,
        clientSecret: piData.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/live/${p.slug}?payment_success=true&song=${encodeURIComponent(p.songTitle)}`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || 'Card authorization failed');
        toast.error(error.message || 'Payment failed');
      } else {
        // Confirmed! Insert into Supabase
        const { data: newReq } = await supabase
          .from('requests')
          .insert({
            band_id: p.bandId,
            event_id: p.eventId || null,
            song_title: p.isDirectTip ? '💖 Direct Tip to the Band' : p.songTitle,
            song_artist: p.isDirectTip ? 'Thank You!' : (p.songArtist || 'Custom Song'),
            fan_name: p.fanName.trim() || 'Anonymous Fan',
            fan_message: p.fanMessage.trim(),
            song_price: Number(p.songPrice || 0),
            tip_amount: Number(p.tipAmount || 0),
            fan_fee: Number(p.fanFee || 0),
            total_paid: Number(p.amount),
            status: p.isDirectTip ? 'completed' : 'pending',
            payment_status: p.isDirectTip ? 'paid' : 'authorized',
            payment_method: 'card',
            stripe_payment_id: paymentIntent?.id || piData.paymentIntentId,
          })
          .select()
          .single();

        if (onSuccess) onSuccess(newReq);
      }
    } catch (err) {
      console.error('Card confirm error:', err);
      setErrorMessage(err.message || 'Payment failed');
      toast.error(err.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          padding: '1.5rem',
          color: 'var(--text-muted)',
          fontSize: '0.9rem'
        }}>
          <RefreshCw size={18} className="spin" color="#3b82f6" />
          <span>Connecting to Apple Pay & secure checkout...</span>
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

      {/* 1. Embedded Apple Pay & Google Pay (Express Checkout Element) */}
      <div style={{ display: loading ? 'none' : 'block', marginBottom: '0.75rem' }}>
        <div
          ref={expressContainerRef}
          style={{ minHeight: hasWallets ? '48px' : '0' }}
        />
      </div>

      {/* 2. Optional "Or Pay with Card" Accordion */}
      {!loading && (
        <div style={{ marginTop: '0.75rem' }}>
          {hasWallets && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '0.85rem 0',
              gap: '0.75rem'
            }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
              <button
                type="button"
                onClick={() => setShowCardForm(!showCardForm)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  padding: '0.2rem 0.5rem',
                }}
              >
                {showCardForm ? 'Hide Card Option' : 'Or Pay with Card'}
              </button>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
            </div>
          )}

          {/* Embedded Card Payment Element */}
          <div style={{ display: (showCardForm || !hasWallets) ? 'block' : 'none' }}>
            <div
              ref={paymentContainerRef}
              style={{
                marginBottom: '1rem',
                minHeight: '120px',
              }}
            />

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
                gap: '0.5rem'
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
        </div>
      )}

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
