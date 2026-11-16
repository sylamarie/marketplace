import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import { recordPaidSession } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase-admin";

// Stripe calls this address by itself (not a browser), to tell us what happened.
//   checkout.session.completed -> a buyer paid: save the order, mark the listing Sold.
//   account.updated            -> a seller's Stripe account changed: refresh "can take payments".
//
// Every request is checked against the signing secret (STRIPE_WEBHOOK_SECRET), so
// nobody can pretend to be Stripe. The signature is computed over the EXACT bytes
// Stripe sent, so the body is read as plain text, before anything parses it.
//
// Answering with an error (500) makes Stripe try again later; answering 200 means
// "got it". Events that are not ours (the sandbox is shared) get a 200 and are ignored.

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const admin = getAdminClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !admin || !secret) {
    console.error("Webhook: Stripe or Supabase is not configured");
    return new Response("not configured", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const result = await recordPaidSession(admin, event.account, event.data.object);
      console.log(`Webhook ${event.id}: checkout.session.completed -> ${result}`);
    } else if (event.type === "account.updated") {
      const account = event.data.object;
      // Only touches a row for an account we saved ourselves; any other account changes nothing.
      const { error } = await admin
        .from("sellers")
        .update({ charges_enabled: account.charges_enabled === true, updated_at: new Date().toISOString() })
        .eq("stripe_account_id", account.id);
      if (error) throw new Error(error.message);
    }
  } catch (error) {
    console.error(`Webhook ${event.id} failed:`, error instanceof Error ? error.message : error);
    return new Response("failed", { status: 500 });
  }

  return Response.json({ received: true });
}
