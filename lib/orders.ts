import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import { isUuid } from "@/lib/listings";
import { normalizeEmail, platformFee } from "@/lib/payments";

// Turns a paid Stripe Checkout into: an order row, and the listing marked as sold.
// Called by the webhook. Safe to run twice for the same payment (Stripe sometimes
// sends an event again): the order row is unique per checkout session.
//
// Returns what happened, so the webhook can log it. Throws if the database fails, so
// the webhook answers with an error and Stripe tries again later.
export type FulfilResult = "recorded" | "ignored";

export async function recordPaidSession(
  admin: SupabaseClient,
  connectedAccount: string | undefined,
  session: Stripe.Checkout.Session,
): Promise<FulfilResult> {
  if (session.payment_status !== "paid") return "ignored";
  const listingId = session.metadata?.listing_id;
  if (!connectedAccount || !listingId || !isUuid(listingId)) return "ignored";
  if (!session.amount_total || session.amount_total <= 0 || !session.currency) return "ignored";

  // The Stripe sandbox is shared with other developers' apps, so events for things
  // that are not ours arrive here too. We only act on a listing we know, whose
  // seller's Stripe account is exactly the account the payment went to.
  const { data: listing, error: listingError } = await admin
    .from("listings")
    .select("id, seller_email")
    .eq("id", listingId)
    .maybeSingle();
  if (listingError) throw new Error(`listing lookup: ${listingError.message}`);
  if (!listing) return "ignored";

  const { data: seller, error: sellerError } = await admin
    .from("sellers")
    .select("stripe_account_id")
    .eq("email", normalizeEmail(listing.seller_email))
    .maybeSingle();
  if (sellerError) throw new Error(`seller lookup: ${sellerError.message}`);
  if (!seller || seller.stripe_account_id !== connectedAccount) return "ignored";

  const order = await admin.from("orders").upsert(
    {
      listing_id: listing.id,
      stripe_session_id: session.id,
      stripe_account_id: connectedAccount,
      buyer_email: session.customer_details?.email ?? null,
      amount_total: session.amount_total,
      platform_fee: platformFee(session.amount_total),
      currency: session.currency,
      status: "paid",
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  if (order.error) throw new Error(`saving order: ${order.error.message}`);

  const sold = await admin.from("listings").update({ sold: true }).eq("id", listing.id);
  if (sold.error) throw new Error(`marking sold: ${sold.error.message}`);
  return "recorded";
}
