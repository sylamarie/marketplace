"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { isUuid } from "@/lib/listings";
import { isCheckoutSessionId } from "@/lib/payments";
import { cn } from "@/lib/utils";

type Order = { title: string; listing_id: string; amount_total: number; currency: string; buyer_email: string | null };
type State = { kind: "waiting" } | { kind: "found"; order: Order } | { kind: "late" } | { kind: "invalid" };

const TRIES = 12; // the webhook usually saves the order within a second or two
const EVERY_MS = 1500;

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

// Where the buyer lands after paying. The order is saved by Stripe's webhook, a
// moment after the payment, so this page asks a few times until it is there.
export function PurchaseSuccess() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") ?? "";
  // Lets the server double-check the payment with Stripe if the webhook is late.
  const listingId = params.get("listing") ?? "";
  const [state, setState] = useState<State>(isCheckoutSessionId(sessionId) ? { kind: "waiting" } : { kind: "invalid" });

  useEffect(() => {
    if (!isCheckoutSessionId(sessionId)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function ask(attempt: number) {
      let order: Order | null = null;
      try {
        const query = `session_id=${encodeURIComponent(sessionId)}${isUuid(listingId) ? `&listing=${encodeURIComponent(listingId)}` : ""}`;
        const response = await fetch(`/api/stripe/order?${query}`, { cache: "no-store" });
        const data = response.ok ? await response.json() : null;
        if (data?.found) order = data as Order;
      } catch {
        order = null;
      }
      if (cancelled) return;
      if (order) setState({ kind: "found", order });
      else if (attempt + 1 >= TRIES) setState({ kind: "late" });
      else timer = setTimeout(() => ask(attempt + 1), EVERY_MS);
    }
    ask(0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, listingId]);

  return (
    <main className="page-container flex-1 py-8">
      <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 text-center shadow-sm" role="status">
        {state.kind === "invalid" ? (
          <>
            <h1 className="text-xl font-bold">Nothing to show here</h1>
            <p className="mt-1 text-sm text-muted-foreground">This page is shown after a purchase.</p>
          </>
        ) : (
          <>
            <CheckCircle2 aria-hidden className="mx-auto size-12 text-green-600" />
            <h1 className="mt-3 text-2xl font-bold">Purchase successful!</h1>
            <p className="mt-1 text-sm text-muted-foreground">Thank you for your purchase. Your payment has been processed.</p>

            {state.kind === "waiting" && <p className="mt-4 text-sm text-muted-foreground">Saving your order…</p>}

            {state.kind === "found" && (
              <dl className="mt-5 space-y-1 rounded-lg bg-muted p-3 text-left text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Item</dt>
                  <dd className="min-w-0 text-right font-medium break-words">{state.order.title}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd className="font-medium">{money(state.order.amount_total, state.order.currency)}</dd>
                </div>
                {state.order.buyer_email && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Receipt for</dt>
                    <dd className="min-w-0 text-right font-medium break-all">{state.order.buyer_email}</dd>
                  </div>
                )}
              </dl>
            )}

            {state.kind === "late" && (
              <p className="mt-4 text-sm text-muted-foreground">
                Your payment went through. Your order is taking a little longer than usual to appear, and it will show up shortly.
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {state.kind === "found" && (
                <Link href={`/item/${state.order.listing_id}`} className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
                  View this item
                </Link>
              )}
              <Link href="/" className={cn(buttonVariants({ size: "lg" }))}>
                Continue shopping
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
