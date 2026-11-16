import type { NextRequest } from "next/server";

import { isCheckoutSessionId } from "@/lib/payments";
import { getAdminClient } from "@/lib/supabase-admin";

// The success page asks here: "has the order for this checkout been saved yet?"
// The webhook saves it a moment after the payment, so the page asks a few times.
// The checkout session id in the address is long and random, so only the buyer
// who just paid knows it. Only a few harmless details come back.

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";
  if (!isCheckoutSessionId(sessionId)) return Response.json({ error: "invalid" }, { status: 400 });

  const admin = getAdminClient();
  if (!admin) return Response.json({ error: "not_configured" }, { status: 500 });

  const { data, error } = await admin
    .from("orders")
    .select("amount_total, currency, buyer_email, listing_id, listings(title)")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (error) {
    console.error("Order lookup failed:", error.message);
    return Response.json({ error: "lookup_failed" }, { status: 500 });
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
