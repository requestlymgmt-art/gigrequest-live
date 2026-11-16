// src/components/checkout/StripeEmbeddedCheckout.jsx
// Embedded Stripe Express Checkout (Apple Pay & Google Pay ONLY) and Native Card Element
// Fast, real-money pre-authorization with zero Link, zero Klarna, zero Amazon Pay
import { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { STRIPE_LIVE_PUBLISHABLE_KEY } from '../../lib/stripe';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, CreditCard, RefreshCw, AlertCircle, Lock } from 'lucide-react';
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
  onSuccess,
  onCancel,
}) {
  const expressContainerRef = useRef(null);
  const cardContainerRef = useRef(null);
  const cardElementRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [stripeInstance, setStripeInstance] = useState(null);
  const [hasWallets, setHasWallets] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cardComplete, setCardComplete] = useState(false);

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
    let cardElement = null;

    async function initStripeElements() {
      setLoading(true);
      setErrorMessage('');

      try {
        const stripe = await getStripe();
        if (!stripe || !isMounted) return;
        setStripeInstance(stripe);

        // 1. Express Checkout instance (Apple Pay & Google Pay ONLY)
        // Explicitly set link, amazonPay, paypal, klarna to 'never' so ONLY Apple Pay and Google Pay appear!
        const expressElements = stripe.elements({
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
            },
          },
        });

        if (expressContainerRef.current) {
          expressContainerRef.current.innerHTML = '';
          expressElement = expressElements.create('expressCheckout', {
            paymentMethods: {
              applePay: 'auto',
              googlePay: 'auto',
              link: 'never',
              amazonPay: 'never',
              paypal: 'never',
              klarna: 'never',
            },
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
                availablePaymentMethods?.googlePay
              );
              setHasWallets(available);
            }
          });

          // Confirm via Express Checkout (native Apple Pay double-click & Face ID)
          expressElement.on('confirm', async (event) => {
            setProcessing(true);
            const p = propsRef.current;
            try {
              // Create PaymentIntent on server with metadata and authorization hold
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

              // Confirm payment in-place without redirecting
              const { error, paymentIntent } = await stripe.confirmPayment({
                elements: expressElements,
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

                confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
                toast.success('🎉 Real payment authorized with Apple Pay!');
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

        // 2. Dedicated Card Element for direct Credit/Debit Card payments
        // Separate from expressElements so there are ZERO conflicts, and it always renders cleanly!
        const cardElements = stripe.elements();
        cardElement = cardElements.create('card', {
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

        cardElement.on('change', (event) => {
          if (isMounted) {
            setCardComplete(event.complete);
            if (event.error) {
              setErrorMessage(event.error.message);
            } else {
              setErrorMessage('');
            }
          }
        });

        if (cardContainerRef.current) {
          cardContainerRef.current.innerHTML = '';
          cardElement.mount(cardContainerRef.current);
        }
        cardElementRef.current = cardElement;

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
      if (cardElement) {
        try { cardElement.destroy(); } catch (e) {}
      }
    };
  }, [amountInCents, isDirectTip]);

  // Handle Card Submission using rock-solid confirmCardPayment
  const handleCardSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!stripeInstance || !cardElementRef.current) return;

    setProcessing(true);
    setErrorMessage('');
    const p = propsRef.current;

    try {
      // 1. Create PaymentIntent on server
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

      // 2. Confirm card payment with pre-authorized hold (or direct capture for tip)
      const { error, paymentIntent } = await stripeInstance.confirmCardPayment(
        piData.clientSecret,
        {
          payment_method: {
            card: cardElementRef.current,
            billing_details: {
              name: p.fanName.trim() || undefined,
            },
          },
        }
      );

      if (error) {
        setErrorMessage(error.message || 'Card authorization failed');
        toast.error(error.message || 'Card payment failed');
      } else if (
        paymentIntent &&
        (paymentIntent.status === 'requires_capture' || paymentIntent.status === 'succeeded')
      ) {
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
            stripe_payment_id: paymentIntent.id,
          })
          .select()
          .single();

        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        toast.success(
          p.isDirectTip
            ? '🎉 Tip sent successfully to the band!'
            : '🎉 Song request authorized & sent to stage!'
        );
        if (onSuccess) onSuccess(newReq);
      }
    } catch (err) {
      console.error('Card submit error:', err);
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
          fontSize: '0.85rem'
        }}>
          <RefreshCw size={16} className="spin" color="#3b82f6" />
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

      {/* 1. Native Apple Pay & Google Pay (Express Checkout) */}
      <div style={{ display: loading ? 'none' : 'block' }}>
        <div
          ref={expressContainerRef}
          style={{ minHeight: hasWallets ? '48px' : '0' }}
        />
      </div>

      {/* 2. "OR PAY WITH CARD" Section with Clean Native Card Inputs */}
      {!loading && (
        <div style={{ marginTop: hasWallets ? '0.75rem' : '0' }}>
          {hasWallets && (
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

          {/* Dedicated Card Element Input Box */}
          <div style={{
            background: '#131826',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '10px',
            padding: '13px 14px',
            marginBottom: '1rem',
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
