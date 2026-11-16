import Stripe from "stripe";

// The connection to Stripe. It uses the SECRET key, so this file must only be used
// by server code (the routes in app/api), never by anything in a "use client" file.
// The key's name has no NEXT_PUBLIC_ in it on purpose, so it can't reach the browser.
let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}
