import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import { DEFAULT_API_URL, DEFAULT_FROM, buildSellerEmail, sendEmail } from "@/lib/email";
import { isUuid, validateMessage } from "@/lib/listings";
import { createLimiter } from "@/lib/rate-limit";

// "Message the seller" goes through this server route (and not straight from the
// browser to Supabase) so that it can do two things in order:
//   1. SAVE the message in Supabase. This always comes first and always counts.
//   2. Then EMAIL the seller, if an email service is set up. If this step fails,
//      the message is still saved and the buyer is told honestly.
// The secret email key lives only here, on the server.

const TEN_MINUTES = 10 * 60 * 1000;
// Best-effort protection against someone flooding a seller with emails.
const perVisitor = createLimiter({ max: 10, windowMs: TEN_MINUTES });
const perListing = createLimiter({ max: 5, windowMs: TEN_MINUTES });

const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

export async function POST(request: NextRequest) {
  // Only our own website may use this route (blocks other websites' scripts).
  const origin = request.headers.get("origin");
  if (origin) {
    let sameSite = false;
    try {
      sameSite = new URL(origin).host === request.nextUrl.host;
    } catch {
      sameSite = false;
    }
    if (!sameSite) return reply(403, { error: "forbidden" });
  }

  // Read and check what was sent.
  const raw = await request.text();
  if (raw.length > 10_000) return reply(413, { error: "too_large" });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: "invalid" });
  }
  const { listing_id, buyer_email, message } = (body ?? {}) as Record<string, unknown>;
  if (typeof listing_id !== "string" || !isUuid(listing_id) || typeof buyer_email !== "string" || typeof message !== "string") {
    return reply(400, { error: "invalid" });
  }
  const problems = validateMessage({ email: buyer_email, message });
  if (problems.email || problems.message) return reply(400, { error: "invalid", fields: problems });
  const buyerEmail = buyer_email.trim();
  const text = message.trim();

  // Not too many, too fast.
  const visitor = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
  if (!perVisitor.allow(visitor) || !perListing.allow(listing_id)) return reply(429, { error: "too_many" });

  // Connect to Supabase with the same public key the browser uses.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return reply(500, { error: "not_configured" });
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // The seller's address comes from the saved listing, never from the request.
  const { data: listing, error: lookupError } = await supabase
    .from("listings")
    .select("id, title, seller_email")
    .eq("id", listing_id)
    .maybeSingle();
  if (lookupError) {
    console.error("Could not look up listing:", lookupError.message);
    return reply(500, { error: "save_failed" });
  }
  if (!listing) return reply(404, { error: "not_found" });

  // Step 1: save the message.
  const { error: saveError } = await supabase.from("messages").insert({ listing_id, buyer_email: buyerEmail, message: text });
  if (saveError) {
    console.error("Could not save message:", saveError.message);
    return reply(500, { error: "save_failed" });
  }

  // Step 2: email the seller (if an email service is set up).
  let emailed = false;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const email = buildSellerEmail({
      title: listing.title,
      listingUrl: `${request.nextUrl.origin}/item/${listing.id}`,
      buyerEmail,
      message: text,
    });
    const result = await sendEmail(
      {
        apiKey,
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        apiUrl: process.env.RESEND_API_URL || DEFAULT_API_URL,
      },
      { to: listing.seller_email, replyTo: buyerEmail, ...email },
    );
    emailed = result.ok;
    if (!result.ok) console.error("Seller email not sent:", result.reason);
  }

  return reply(200, { saved: true, emailed });
}
