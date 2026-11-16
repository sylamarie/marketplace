import type { NextRequest } from "next/server";

import { isStripeAccountId } from "@/lib/payments";
import { isSameOrigin } from "@/lib/same-origin";
import { getStripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase-admin";

// After a seller comes back from Stripe's onboarding form, this asks Stripe "can this
// account take payments now?" and saves the answer. (The webhook's account.updated
// event does the same thing; this just makes the answer instant for the seller.)

const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return reply(403, { error: "forbidden" });

  let accountId: unknown;
  try {
    accountId = ((await request.json()) as Record<string, unknown>)?.account;
  } catch {
    return reply(400, { error: "invalid" });
  }
  if (typeof accountId !== "string" || !isStripeAccountId(accountId)) return reply(400, { error: "invalid" });

  const stripe = getStripe();
  const admin = getAdminClient();
  if (!stripe || !admin) return reply(500, { error: "not_configured" });

  // Only accounts that WE created and saved are looked at.
  const seller = await admin.from("sellers").select("email").eq("stripe_account_id", accountId).maybeSingle();
  if (seller.error) return reply(500, { error: "lookup_failed" });
  if (!seller.data) return reply(404, { error: "unknown_account" });

  try {
    const account = await stripe.accounts.retrieve(accountId);
    const ready = account.charges_enabled === true;
    const saved = await admin
      .from("sellers")
      .update({ charges_enabled: ready, updated_at: new Date().toISOString() })
      .eq("stripe_account_id", accountId);
    if (saved.error) throw new Error(saved.error.message);
    return reply(200, { ready, email: seller.data.email });
  } catch (error) {
    console.error("Stripe sync failed:", error instanceof Error ? error.message : error);
    return reply(502, { error: "stripe_failed" });
  }
}
