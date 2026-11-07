// src/lib/stripe.js
// Handles transparent fee calculations where the fan pays the Requestly fee & Stripe fee
// so the artist receives 100% of the song price and tip.

export function calculateFeeBreakdown(baseAmount, tipAmount = 0) {
  const base = Math.max(0, Number(baseAmount) || 0);
  const tip = Math.max(0, Number(tipAmount) || 0);
  const artistNet = base + tip; // Band keeps 100% of song price and tip!

  // Total request value (song price + tip)
  const totalRequest = artistNet;

  // Requestly Platform Fee:
  // $2 for $0-$20 Request, or 10% of $20+
  // Evaluated on total request amount so adding tips or custom requests properly triggers 10% when > $20.
  let requestlyFee = 0;
  if (totalRequest > 0) {
    if (totalRequest <= 20) {
      requestlyFee = 2.00;
    } else {
      requestlyFee = Math.round((totalRequest * 0.10) * 100) / 100;
    }
  }

  const subtotalWithPlatform = totalRequest + requestlyFee;

  // Stripe processing fee: 2.9% + $0.30
  // Formula ensuring artist receives 100% of subtotal and Requestly receives full platform fee:
  // totalCharged = (subtotalWithPlatform + 0.30) / (1 - 0.029)
  const STRIPE_PERCENT = 0.029;
  const STRIPE_FIXED = 0.30;

  let totalCharged = subtotalWithPlatform > 0
    ? (subtotalWithPlatform + STRIPE_FIXED) / (1 - STRIPE_PERCENT)
    : 0;
  totalCharged = Math.round(totalCharged * 100) / 100;

  const stripeFee = Math.max(0, Math.round((totalCharged - subtotalWithPlatform) * 100) / 100);
  const fanFee = Math.max(0, Math.round((requestlyFee + stripeFee) * 100) / 100);

  return {
    subtotal: Number(totalRequest.toFixed(2)),
    baseAmount: Number(base.toFixed(2)),
    tipAmount: Number(tip.toFixed(2)),
    requestlyFee: Number(requestlyFee.toFixed(2)),
    stripeFee: Number(stripeFee.toFixed(2)),
    fanFee: Number(fanFee.toFixed(2)), // Combined transparent fan fee (Requestly + Stripe)
    totalCharged: Number(totalCharged.toFixed(2)),
    artistNet: Number(artistNet.toFixed(2)), // Band keeps 100% of song price and tip!
    isPercentFee: totalRequest > 20,
  };
}

export async function processStripePayment({
  amount,
  fanFee,
  requestlyFee = 0,
  stripeFee = 0,
  totalCharged,
  bandId,
  songTitle,
  fanName,
  fanMessage,
  paymentMethod = 'card'
}) {
  // Simulate Stripe payment processing latency with instant confirmation
  // In production, this can invoke a Stripe Checkout Session or PaymentIntent endpoint
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const paymentIntentId = `pi_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;

  return {
    success: true,
    paymentIntentId,
    amount,
    fanFee,
    requestlyFee,
    stripeFee,
    totalCharged,
    status: 'paid',
  };
}
