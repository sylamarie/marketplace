"use client";

import { CreditCard, ShieldCheck, Store } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLATFORM_FEE_PERCENT } from "@/lib/payments";
import { LIMITS, isValidEmail } from "@/lib/listings";

// "Connect with Stripe" for sellers. There are no logins, so the seller types the
// email they use on their listings. That email is how we know which listings are theirs.
export function ConnectForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError(trimmed ? "That doesn't look like an email address." : "Please enter the email you use on your listings.");
      document.getElementById("seller-email")?.focus();
      return;
    }
    setError(null);
    setBusy(true);

    let url: string | null = null;
    let status = 0;
    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      status = response.status;
      if (response.ok) url = ((await response.json()) as { url?: string }).url ?? null;
    } catch {
      status = 0;
    }

    if (url) {
      window.location.assign(url); // off to Stripe's own onboarding form
      return; // stay "busy" while the browser leaves
    }
    setBusy(false);
    setError(
      status === 429
        ? "That's a lot of tries. Please wait a few minutes and try again."
        : "Sorry, we couldn't reach Stripe. Please try again in a moment.",
    );
  }

  return (
    <main className="page-container flex-1 py-8">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold">Get paid with Stripe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a Stripe account and buyers can pay you straight from your listing with a Buy now button.
        </p>

        <ol className="mt-6 space-y-3">
          {[
            { icon: Store, text: "Enter the email you use on your listings. Every listing with that email gets a Buy now button." },
            { icon: CreditCard, text: "Stripe asks for a few details on its own secure page. This is Stripe's test mode, so use test details, never real ones." },
            { icon: ShieldCheck, text: `When an item sells, the money goes to you. The marketplace keeps a ${PLATFORM_FEE_PERCENT}% fee.` },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 rounded-xl border bg-card p-3 text-sm shadow-sm">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="self-center">{text}</span>
            </li>
          ))}
        </ol>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <label htmlFor="seller-email" className="mb-1 block text-sm font-medium">
              Your seller email
            </label>
            <Input
              id="seller-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={LIMITS.email}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "seller-email-error" : undefined}
            />
            {error && (
              <p id="seller-email-error" role="alert" className="mt-1 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" disabled={busy} className="h-10 w-full text-base">
            {busy ? "Opening Stripe…" : "Connect with Stripe"}
          </Button>
        </form>
      </div>
    </main>
  );
}
