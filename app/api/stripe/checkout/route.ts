import type { NextRequest } from "next/server";

import { IMAGE_BUCKET, isUuid } from "@/lib/listings";
import { buyState, normalizeEmail, platformFee, toCents } from "@/lib/payments";
import { createLimiter } from "@/lib/rate-limit";
import { isSameOrigin, visitorId } from "@/lib/same-origin";
import { getStripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase-admin";

// "Buy now": makes a Stripe Checkout page for one listing and sends its address back.
//
// The price, the seller and the fee are ALL decided here on the server, from the
// saved listing. The browser only says which listing: it can't choose a price.
//
// It is a "direct charge": the payment is created on the seller's own Stripe
// account (the { stripeAccount } option), and the marketplace takes its cut as the
// application fee.

const perVisitor = createLimiter({ max: 20, windowMs: 10 * 60 * 1000 });
const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return reply(403, { error: "forbidden" });

  let listingId: unknown;
  try {
    listingId = ((await request.json()) as Record<string, unknown>)?.listing_id;
  } catch {
    return reply(400, { error: "invalid" });
  }
  if (typeof listingId !== "string" || !isUuid(listingId)) return reply(400, { error: "invalid" });
  if (!perVisitor.allow(visitorId(request))) return reply(429, { error: "too_many" });

  const stripe = getStripe();
  const admin = getAdminClient();
  if (!stripe || !admin) return reply(500, { error: "not_configured" });

  const { data: listing, error } = await admin
    .from("listings")
    .select("id, title, description, price, seller_email, image_path, sold")
    .eq("id", listingId)
    .maybeSingle();
  if (error) {
    console.error("Checkout: could not load listing:", error.message);
    return reply(500, { error: "lookup_failed" });
  }
  if (!listing) return reply(404, { error: "not_found" });

  const { data: seller } = await admin
    .from("sellers")
    .select("stripe_account_id, charges_enabled")
    .eq("email", normalizeEmail(listing.seller_email))
    .maybeSingle();

  const price = Number(listing.price);
  const state = buyState({ price, sold: listing.sold === true }, seller?.charges_enabled === true);
  if (state !== "buyable" || !seller) return reply(409, { error: state });

  const cents = toCents(price);
  const origin = request.nextUrl.origin;
  const description = String(listing.description ?? "").trim().slice(0, 300);

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: cents,
              product_data: {
                name: listing.title,
                ...(description ? { description } : {}),
                // The photo's public address in our own Supabase Storage bucket.
                images: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${listing.image_path}`],
              },
            },
          },
        ],
        // The marketplace's cut.
        payment_intent_data: { application_fee_amount: platformFee(cents), metadata: { listing_id: listing.id } },
        // The webhook reads this to know which listing was bought.
        metadata: { listing_id: listing.id },
        success_url: `${origin}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/item/${listing.id}`,
      },
      { stripeAccount: seller.stripe_account_id },
    );
    if (!session.url) throw new Error("Stripe gave no checkout address");
    return reply(200, { url: session.url });
  } catch (err) {
    console.error("Checkout failed:", err instanceof Error ? err.message : err);
    return reply(502, { error: "stripe_failed" });
  }
}
