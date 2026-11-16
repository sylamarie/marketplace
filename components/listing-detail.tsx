"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { categoryName } from "@/lib/categories";
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

  const [buyerEmail, setBuyerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<MessageErrors>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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
        setListing(data as Listing);
        setStatus("ready");
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

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
    // No ".select()" here on purpose: visitors may add messages but not read them back.
    const { error } = await supabase.from("messages").insert({
      listing_id: listing.id,
      buyer_email: buyerEmail.trim(),
      message: message.trim(),
    });
    setSending(false);

    if (error) {
      console.error("Could not send message:", error.message);
      setSendError("Sorry, your message could not be sent. Please try again.");
      return;
    }
    setSent(true);
    setMessage("");
  }

  const backLink = (
    <Link href="/" className="mb-4 inline-block text-sm text-primary hover:underline">
      ← Back to Marketplace
    </Link>
  );

  if (status !== "ready" || !listing) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {backLink}
        {status === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}
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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      {backLink}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex items-center justify-center overflow-hidden rounded-xl border bg-card p-2 shadow-sm">
          <Photo
            path={listing.image_path}
            alt={listing.title}
            eager
            className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain"
          />
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <h1 className="text-2xl font-bold break-words">{listing.title}</h1>
            <p className="mt-1 text-xl font-semibold">{formatPrice(Number(listing.price))}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Listed {listedAgo(listing.created_at, now)}
              {listing.location ? ` in ${listing.location}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">Category: {categoryName(listing.category)}</p>
          </div>

          {listing.description && (
            <div>
              <h2 className="text-sm font-semibold">Description</h2>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap">{listing.description}</p>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold">Seller information</h2>
            <a href={`mailto:${listing.seller_email}`} className="mt-1 block text-sm break-all text-primary hover:underline">
              {listing.seller_email}
            </a>
          </div>

          <section aria-labelledby="message-heading" className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 id="message-heading" className="mb-3 font-semibold">
              Message seller
            </h2>

            {sent ? (
              <div role="status" className="space-y-3">
                <p className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
                  <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Your message was sent and saved for the seller.
                </p>
                <Button type="button" variant="outline" onClick={() => setSent(false)} className="w-full">
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
