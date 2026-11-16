import type { NextRequest } from "next/server";

import { isStripeAccountId } from "@/lib/payments";
import { isSameOrigin } from "@/lib/same-origin";
import { refreshSellerStatus } from "@/lib/seller-status";
import { getStripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase-admin";

// After a seller comes back from Stripe's onboarding form, this asks Stripe "can this
// account take payments now?" and saves the answer, so the Buy now button can appear
// straight away. (The webhook's account.updated event does the same thing later.)

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

  try {
    const result = await refreshSellerStatus(stripe, admin, accountId);
    if (!result) return reply(404, { error: "unknown_account" });
    return reply(200, result);
  } catch (error) {
    console.error("Stripe sync failed:", error instanceof Error ? error.message : error);
    return reply(502, { error: "stripe_failed" });
  }
}
