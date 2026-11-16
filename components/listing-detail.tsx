"use client";

import { CheckCircle2, Clock, MapPin, ShoppingCart, Tag } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { categoryName } from "@/lib/categories";
import { buyState, normalizeEmail } from "@/lib/payments";
import {
  LIMITS,
  formatPrice,
  isUuid,
  listedAgo,
  validateMessage,
  type Listing,
  type MessageErrors,
} from "@/lib/listings";
import { supabase } from "@/lib/supabase";
import { useNow } from "@/lib/use-now";

type Status = "loading" | "ready" | "notfound" | "error" | "unconfigured";

// Ready-made first messages, like on Facebook Marketplace. Click one to fill the box.
const QUICK_MESSAGES = [
  "I'm interested in this item.",
  "Is this item still available?",
  "What condition is this item in?",
  "Do you deliver?",
];

// A listing's own page: photo, full details, and a form to message the seller.
export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const now = useNow();

  const [listing, setListing] = useState<Listing | null>(null);
  const [status, setStatus] = useState<Status>(
    !supabase ? "unconfigured" : isUuid(id) ? "loading" : "notfound",
  );
  // Has this listing's seller finished Stripe onboarding? (Decides if "Buy now" shows.)
  const [sellerReady, setSellerReady] = useState(false);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  const [buyerEmail, setBuyerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<MessageErrors>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // null = nothing sent yet. Otherwise: was the seller also emailed?
  const [sent, setSent] = useState<{ emailed: boolean } | null>(null);

  useEffect(() => {
    if (!supabase || !isUuid(id)) return;
    const client = supabase;
    let cancelled = false;

    async function load() {
      const { data, error } = await client.from("listings").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Could not load listing:", error.message);
        setStatus("error");
      } else if (!data) {
        setStatus("notfound");
      } else {
        const found = data as Listing;
        // A small public list of the emails of sellers who can take payments.
        const { data: ready } = await client
          .from("onboarded_sellers")
          .select("email")
          .eq("email", normalizeEmail(found.seller_email))
          .maybeSingle();
        if (cancelled) return;
        setSellerReady(Boolean(ready));
        setListing(found);
        setStatus("ready");
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // "Buy now": ask our server for a Stripe Checkout page, then go there. The server
  // decides the price and the seller from the saved listing; we only say which one.
  async function onBuy() {
    if (!listing || buying) return;
    setBuyError(null);
    setBuying(true);
    let url: string | null = null;
    let reason = "";
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listing.id }),
      });
      const result = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (response.ok && result.url) url = result.url;
      else reason = result.error ?? "";
    } catch {
      reason = "";
    }
    if (url) {
      window.location.assign(url); // off to Stripe's secure checkout page
      return; // stay "busy" while the browser leaves
    }
    setBuying(false);
    setBuyError(
      reason === "sold"
        ? "Sorry, this item has just been sold."
        : "Sorry, we couldn't start the checkout. Please try again.",
    );
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !listing || sending) return;
    setSendError(null);

    const found = validateMessage({ email: buyerEmail, message });
    setErrors(found);
    if (found.email || found.message) {
      document.getElementById(found.email ? "buyer-email" : "message")?.focus();
      return;
    }

    setSending(true);
    // The message goes to our own server route, which saves it in Supabase and then
    // emails the seller (when an email service is set up). See app/api/messages.
    let response: Response | null = null;
    try {
      response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listing.id,
          buyer_email: buyerEmail.trim(),
          message: message.trim(),
        }),
      });
    } catch {
      response = null; // no connection
    }
    setSending(false);

    if (response?.status === 429) {
      setSendError("That's a lot of messages. Please wait a few minutes and try again.");
      return;
    }
    if (!response || !response.ok) {
      console.error("Could not send message:", response?.status ?? "no connection");
      setSendError("Sorry, your message could not be sent. Please try again.");
      return;
    }
    const result = (await response.json().catch(() => ({}))) as { emailed?: boolean };
    setSent({ emailed: result.emailed === true });
    setMessage("");
  }

  const backLink = (
    <Link href="/" className="mb-4 inline-block text-sm text-primary hover:underline">
      ← Back to Marketplace
    </Link>
  );

  if (status !== "ready" || !listing) {
    return (
      <main className="page-container flex-1 py-6">
        {backLink}
        {status === "loading" && (
          <div role="status" aria-label="Loading listing" className="grid gap-6 lg:grid-cols-[1fr_clamp(22rem,26vw,30rem)]">
            <div className="min-h-[22rem] animate-pulse rounded-xl bg-muted lg:min-h-[32rem]" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-6 w-1/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            </div>
          </div>
        )}
        {status === "notfound" && (
          <div>
            <h1 className="text-xl font-bold">Listing not found</h1>
            <p className="mt-1 text-sm text-muted-foreground">It may have been removed, or the address is wrong.</p>
          </div>
        )}
        {status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            Sorry, this listing could not be loaded. Please refresh the page.
          </p>
        )}
        {status === "unconfigured" && (
          <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            This marketplace isn&apos;t connected to Supabase yet. See <code>.env.local.example</code>.
          </p>
        )}
      </main>
    );
  }

  const remaining = LIMITS.message - message.length;
  const buy = buyState({ price: Number(listing.price), sold: listing.sold }, sellerReady);

  return (
    <main className="page-container flex-1 py-6">
      {backLink}
      <div className="grid gap-6 lg:grid-cols-[1fr_clamp(22rem,26vw,30rem)]">
        {/* The photo sits on a soft, blurred copy of itself (like Facebook), so there
            are no empty white bands above and below it. The blurred copy is only
            decoration, so it has no description for screen readers. */}
        <div className="relative flex min-h-[22rem] items-center justify-center overflow-hidden rounded-xl border bg-muted shadow-sm lg:min-h-[32rem]">
          <Photo
            path={listing.image_path}
            alt=""
            eager
            className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-2xl"
          />
          <Photo
            path={listing.image_path}
            alt={listing.title}
            eager
            className="relative max-h-[75vh] w-auto max-w-full object-contain shadow-lg"
          />
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <h1 className="text-2xl leading-tight font-bold break-words">{listing.title}</h1>
            <p className={`mt-1 flex items-center gap-3 text-3xl font-bold ${Number(listing.price) === 0 ? "text-green-700" : ""}`}>
              {formatPrice(Number(listing.price))}
              {buy === "sold" && (
                <span className="rounded-full bg-destructive px-3 py-0.5 text-sm font-semibold text-white">Sold</span>
              )}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Clock aria-hidden className="size-4 shrink-0" />
                <span>Listed {listedAgo(listing.created_at, now)}</span>
              </li>
              {listing.location && (
                <li className="flex items-center gap-2">
                  <MapPin aria-hidden className="size-4 shrink-0" />
                  <span className="break-words">{listing.location}</span>
                </li>
              )}
              <li className="flex items-center gap-2">
                <Tag aria-hidden className="size-4 shrink-0" />
                <span>{categoryName(listing.category)}</span>
              </li>
            </ul>
          </div>

          {/* Buying: a Buy now button when the seller can take payments, or an honest note. */}
          {buy === "buyable" && (
            <div>
              <Button type="button" size="lg" onClick={onBuy} disabled={buying} className="h-11 w-full gap-2 text-base">
                <ShoppingCart aria-hidden className="size-4" />
                {buying ? "Opening checkout…" : `Buy now · ${formatPrice(Number(listing.price))}`}
              </Button>
              <p className="mt-1.5 text-center text-xs text-muted-foreground">Secure payment by Stripe (test mode)</p>
              {buyError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {buyError}
                </p>
              )}
            </div>
          )}
          {buy === "sold" && (
            <p role="status" className="rounded-md bg-muted p-3 text-sm">
              This item has been sold.
            </p>
          )}
          {buy === "seller-not-ready" && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              Online payment isn&apos;t set up for this seller yet. You can message them below. Are you the seller?{" "}
              <Link href="/connect" className="font-medium text-primary hover:underline">
                Connect with Stripe
              </Link>
            </p>
          )}

          {listing.description && (
            <div>
              <h2 className="text-sm font-semibold">Description</h2>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap">{listing.description}</p>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold">Seller information</h2>
            <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                {Array.from(listing.seller_email)[0]?.toUpperCase()}
              </span>
              <a href={`mailto:${listing.seller_email}`} className="min-w-0 text-sm font-medium break-all text-primary hover:underline">
                {listing.seller_email}
              </a>
            </div>
          </div>

          <section aria-labelledby="message-heading" className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 id="message-heading" className="mb-3 font-semibold">
              Message seller
            </h2>

            {sent ? (
              <div role="status" className="space-y-3">
                <p className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
                  <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {sent.emailed
                    ? "Your message was sent. The seller has also been notified by email."
                    : "Your message was sent and saved for the seller."}
                </p>
                <Button type="button" variant="outline" onClick={() => setSent(null)} className="w-full">
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={onSend} noValidate className="space-y-3">
                <div className="flex flex-wrap gap-1.5" aria-label="Quick messages">
                  {QUICK_MESSAGES.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => setMessage(text)}
                      className="rounded-full border bg-muted px-2.5 py-1 text-xs hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {text}
                    </button>
                  ))}
                </div>

                <div>
                  <label htmlFor="buyer-email" className="mb-1 block text-sm font-medium">
                    Your email
                  </label>
                  <Input
                    id="buyer-email"
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    maxLength={LIMITS.email}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? "buyer-email-error" : undefined}
                  />
                  {errors.email && (
                    <p id="buyer-email-error" role="alert" className="mt-1 text-sm text-destructive">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="message" className="mb-1 block text-sm font-medium">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={LIMITS.message}
                    rows={4}
                    placeholder="Please type your message to the seller"
                    aria-invalid={errors.message ? true : undefined}
                    aria-describedby={errors.message ? "message-error" : undefined}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{remaining} characters remaining</p>
                  {errors.message && (
                    <p id="message-error" role="alert" className="text-sm text-destructive">
                      {errors.message}
                    </p>
                  )}
                </div>

                {sendError && (
                  <p role="alert" className="text-sm text-destructive">
                    {sendError}
                  </p>
                )}
                <Button type="submit" size="lg" disabled={sending} className="h-10 w-full text-base">
                  {sending ? "Sending…" : "Send message"}
                </Button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
