// src/lib/stripe.js
// Handles transparent fee calculations where the fan pays the Stripe fee so the artist gets 100%

export function calculateFeeBreakdown(baseAmount, tipAmount = 0) {
  const subtotal = Math.max(0, Number(baseAmount) + Number(tipAmount));
  
  // Standard card processing fee: 2.9% + $0.30
  // Formula to ensure artist receives 100% of subtotal:
  // total = (subtotal + 0.30) / (1 - 0.029)
  const STRIPE_PERCENT = 0.029;
  const STRIPE_FIXED = 0.30;
  
  let totalCharged = subtotal > 0 ? (subtotal + STRIPE_FIXED) / (1 - STRIPE_PERCENT) : 0;
  totalCharged = Math.round(totalCharged * 100) / 100;
  
  const fanFee = Math.max(0, Math.round((totalCharged - subtotal) * 100) / 100);
  
  return {
    subtotal: Number(subtotal.toFixed(2)),
    baseAmount: Number(Number(baseAmount).toFixed(2)),
    tipAmount: Number(Number(tipAmount).toFixed(2)),
    fanFee: Number(fanFee.toFixed(2)),
    totalCharged: Number(totalCharged.toFixed(2)),
    artistNet: Number(subtotal.toFixed(2)), // Band keeps 100% of song price and tip!
  };
}

export async function processStripePayment({
  amount,
  fanFee,
  totalCharged,
  bandId,
  songTitle,
  fanName,
  fanMessage,
  paymentMethod = 'card'
}) {
  // Simulate Stripe payment processing latency with instant confirmation
  // In production, this can invoke a Stripe Checkout Session or PaymentIntent endpoint
  await new Promise((resolve) => setTimeout(resolve, 1400));
  
  const paymentIntentId = `pi_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
  
  return {
    success: true,
    paymentIntentId,
    amount,
    fanFee,
    totalCharged,
    status: 'paid',
  };
}
