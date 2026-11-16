import type { NextRequest } from "next/server";

import { isValidEmail } from "@/lib/listings";
import { normalizeEmail } from "@/lib/payments";
import { createLimiter } from "@/lib/rate-limit";
import { isSameOrigin, visitorId } from "@/lib/same-origin";
import { getStripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase-admin";

// "Connect with Stripe": a seller types the email they use on their listings.
//   1. If we have no Stripe account for that email yet, create one (an Express
//      account, using Stripe's test mode) and save its id in the "sellers" table.
//   2. Ask Stripe for a one-time link to its hosted onboarding form and send it back.
// The browser then goes to that link. There are no logins: the email is the seller's identity.

const perVisitor = createLimiter({ max: 8, windowMs: 10 * 60 * 1000 });
const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return reply(403, { error: "forbidden" });

  const raw = await request.text();
  if (raw.length > 2_000) return reply(413, { error: "too_large" });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: "invalid" });
  }
  const { email: rawEmail } = (body ?? {}) as Record<string, unknown>;
  if (typeof rawEmail !== "string" || !isValidEmail(rawEmail.trim())) return reply(400, { error: "invalid_email" });
  const email = normalizeEmail(rawEmail);

  if (!perVisitor.allow(visitorId(request))) return reply(429, { error: "too_many" });

  const stripe = getStripe();
  const admin = getAdminClient();
  if (!stripe || !admin) return reply(500, { error: "not_configured" });

  try {
    // Do we already know this seller?
    const found = await admin.from("sellers").select("stripe_account_id, charges_enabled").eq("email", email).maybeSingle();
    if (found.error) throw new Error(`sellers lookup: ${found.error.message}`);
    let accountId = found.data?.stripe_account_id as string | undefined;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email,
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      const saved = await admin.from("sellers").insert({ email, stripe_account_id: account.id });
      if (saved.error) {
        // Two clicks at once can both get here; the database allows only one row per email.
        const again = await admin.from("sellers").select("stripe_account_id").eq("email", email).maybeSingle();
        if (!again.data) throw new Error(`could not save seller: ${saved.error.message}`);
        accountId = again.data.stripe_account_id as string;
      } else {
        accountId = account.id;
      }
    }

    // The one-time link to Stripe's hosted onboarding form. When the seller finishes
    // (or leaves), Stripe sends them to return_url; if the link has expired, to refresh_url.
    const origin = request.nextUrl.origin;
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: `${origin}/connect/return?account=${accountId}`,
      refresh_url: `${origin}/connect`,
    });
    return reply(200, { url: link.url });
  } catch (error) {
    console.error("Stripe connect failed:", error instanceof Error ? error.message : error);
    return reply(502, { error: "stripe_failed" });
  }
}
