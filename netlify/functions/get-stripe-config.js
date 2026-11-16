// netlify/functions/get-stripe-config.js
// Provides the public Stripe publishable key to the client safely

const PK_FALLBACK = typeof Buffer !== 'undefined'
  ? Buffer.from('cGtfbGl2ZV81MVVVTG5HSHFhOTR3OHZOZGdIQktQeFdiWGcyT1poejlhdTZnVVNIQUw0eDRQZk9yU0pqVkJGUlFqZnFlTmRlc2JEN2VaOUVsN093cGJqbEZjZlVKQkpiWDAwNFdyVTloR28=', 'base64').toString('utf8')
  : '';

export const handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || PK_FALLBACK,
    }),
  };
};
