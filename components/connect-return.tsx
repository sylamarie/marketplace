"use client";

import { CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { isStripeAccountId } from "@/lib/payments";
import { cn } from "@/lib/utils";

type State =
  | { kind: "checking" }
  | { kind: "ready"; email: string }
  | { kind: "unfinished"; email: string }
  | { kind: "error" };

// Where Stripe sends a seller when they leave its onboarding form. We ask Stripe
// whether the account can now take payments, and say so.
export function ConnectReturn() {
  const account = useSearchParams().get("account") ?? "";
  const [state, setState] = useState<State>(isStripeAccountId(account) ? { kind: "checking" } : { kind: "error" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isStripeAccountId(account)) return;
    let cancelled = false;

    // Stripe can take a few seconds to switch card payments on after the seller submits
    // the form, so if it isn't active yet we ask again a few times before saying so.
    const TRIES = 7;
    const EVERY_MS = 2000;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check(attempt: number) {
      let result: { ready?: boolean; email?: string } | null = null;
      try {
        const response = await fetch("/api/stripe/connect/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account }),
        });
        if (response.ok) result = await response.json();
      } catch {
        result = null;
      }
      if (cancelled) return;
      if (!result || typeof result.email !== "string") setState({ kind: "error" });
      else if (result.ready) setState({ kind: "ready", email: result.email });
      else if (attempt + 1 >= TRIES) setState({ kind: "unfinished", email: result.email });
      else timer = setTimeout(() => check(attempt + 1), EVERY_MS);
    }
    check(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [account]);

  // "Continue setup": ask for a fresh link to Stripe's form for the same seller.
  async function continueSetup(email: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const { url } = (await response.json()) as { url?: string };
      if (response.ok && url) {
        window.location.assign(url);
        return;
      }
    } catch {
      // fall through to the error state
    }
    setBusy(false);
    setState({ kind: "error" });
  }

  return (
    <main className="page-container flex-1 py-8">
      <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 text-center shadow-sm" role="status">
        {state.kind === "checking" && <p className="text-sm text-muted-foreground">Checking your Stripe account…</p>}

        {state.kind === "ready" && (
          <>
            <CheckCircle2 aria-hidden className="mx-auto size-10 text-green-600" />
            <h1 className="mt-3 text-xl font-bold">You&apos;re connected!</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Listings with the email <strong className="break-all text-foreground">{state.email}</strong> now have a Buy now button.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/create/item" className={cn(buttonVariants({ size: "lg" }))}>
                Create a listing
              </Link>
              <Link href="/" className={cn(buttonVariants({ size: "lg", variant: "outline" }))}>
                Browse the marketplace
              </Link>
            </div>
          </>
        )}

        {state.kind === "unfinished" && (
          <>
            <Clock aria-hidden className="mx-auto size-10 text-amber-600" />
            <h1 className="mt-3 text-xl font-bold">Almost there</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stripe still needs a few details before it can pay you. You can pick up where you left off.
            </p>
            <Button type="button" size="lg" disabled={busy} onClick={() => continueSetup(state.email)} className="mt-5 h-10">
              {busy ? "Opening Stripe…" : "Continue with Stripe"}
            </Button>
          </>
        )}

        {state.kind === "error" && (
          <>
            <h1 className="text-xl font-bold">We couldn&apos;t check your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Please try connecting again.</p>
            <Link href="/connect" className={cn(buttonVariants({ size: "lg" }), "mt-5")}>
              Back to Connect with Stripe
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
