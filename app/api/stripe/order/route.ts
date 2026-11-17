import type { NextRequest } from "next/server";

import { isUuid } from "@/lib/listings";
import { recordPaidSession } from "@/lib/orders";
import { isCheckoutSessionId, normalizeEmail } from "@/lib/payments";
import { createLimiter } from "@/lib/rate-limit";
import { visitorId } from "@/lib/same-origin";
import { getStripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase-admin";

// The success page asks here: "has the order for this checkout been saved yet?"
//
// The webhook is the main way an order gets saved: Stripe tells our server a moment
// after the payment. If the order isn't there yet, this route also asks STRIPE directly
// whether that checkout was really paid, and if so saves the order itself (the same
// way the webhook does; saving is safe to repeat). So the order and the "Sold" badge
// still appear when the webhook is late, or when a webhook can't be registered.
//
// The checkout session id in the address is long and random, so only the buyer who
// just paid knows it. Only a few harmless details come back.

const perVisitor = createLimiter({ max: 60, windowMs: 10 * 60 * 1000 });

const SELECT = "amount_total, currency, buyer_email, listing_id, listings(title)";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";
  if (!isCheckoutSessionId(sessionId)) return Response.json({ error: "invalid" }, { status: 400 });
  if (!perVisitor.allow(visitorId(request))) return Response.json({ error: "too_many" }, { status: 429 });

  const admin = getAdminClient();
  if (!admin) return Response.json({ error: "not_configured" }, { status: 500 });

  const lookup = () => admin.from("orders").select(SELECT).eq("stripe_session_id", sessionId).maybeSingle();

  let { data, error } = await lookup();
  if (error) {
    console.error("Order lookup failed:", error.message);
    return Response.json({ error: "lookup_failed" }, { status: 500 });
  }

  // Not saved yet: double-check the payment with Stripe, then save it.
  if (!data) {
    const listingId = request.nextUrl.searchParams.get("listing") ?? "";
    const stripe = getStripe();
    if (stripe && isUuid(listingId)) {
      try {
        const { data: listing } = await admin.from("listings").select("seller_email").eq("id", listingId).maybeSingle();
        const { data: seller } = listing
          ? await admin.from("sellers").select("stripe_account_id").eq("email", normalizeEmail(listing.seller_email)).maybeSingle()
          : { data: null };
        if (seller) {
          // Asked on the seller's own Stripe account. A session from anywhere else is not found.
          const session = await stripe.checkout.sessions.retrieve(sessionId, {}, { stripeAccount: seller.stripe_account_id });
          if (session.metadata?.listing_id === listingId) {
            const result = await recordPaidSession(admin, seller.stripe_account_id, session);
            console.log(`Order route: double-check of ${sessionId.slice(0, 16)}... -> ${result}`);
            ({ data, error } = await lookup());
          }
        }
      } catch (err) {
        // Not paid yet, or not ours: just report "not found yet". The page asks again.
        console.error("Order double-check failed:", err instanceof Error ? err.message : err);
      }
    }
  }
  if (!data) return Response.json({ found: false });

  const listing = Array.isArray(data.listings) ? data.listings[0] : data.listings;
  return Response.json({
    found: true,
    title: listing?.title ?? "your item",
    listing_id: data.listing_id,
    amount_total: data.amount_total,
    currency: data.currency,
    buyer_email: data.buyer_email,
  });
}
