// Tells Stripe where to send payment news: your site's /api/stripe/webhook address.
// Run it ONCE, after the site is deployed:
//
//   node --env-file=.env.local scripts/create-webhook.mjs https://YOUR-SITE.vercel.app
//
// It prints a "signing secret" (starts with whsec_). Stripe shows it only this one time:
// copy it into STRIPE_WEBHOOK_SECRET (in .env.local and in Vercel), then redeploy.
// The secret is what lets our webhook check that a message really came from Stripe.
import Stripe from "stripe";

const site = process.argv[2];
if (!site || !/^https:\/\/[^/\s]+$/.test(site)) {
  console.error("Please give your live site address, like: https://marketplace-syla.vercel.app");
  process.exit(1);
}
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY is missing. Run this with: node --env-file=.env.local scripts/create-webhook.mjs <site>");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const endpoint = await stripe.webhookEndpoints.create({
  url: `${site}/api/stripe/webhook`,
  // true because our payments are created on the sellers' connected accounts,
  // and only a "Connect" endpoint receives events from those.
  connect: true,
  enabled_events: ["checkout.session.completed", "account.updated"],
});

console.log("Webhook created:", endpoint.id);
console.log("Signing secret:", endpoint.secret);
console.log("Copy the signing secret into STRIPE_WEBHOOK_SECRET now. Stripe will not show it again.");
