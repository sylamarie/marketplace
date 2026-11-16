import { Suspense } from "react";

import { ConnectReturn } from "@/components/connect-return";

export const metadata = { title: "Stripe connected · Marketplace" };

// Stripe sends sellers here after onboarding. The Suspense wrapper shows "Loading…"
// while the page reads the address it was opened with.
export default function ConnectReturnPage() {
  return (
    <Suspense fallback={<p className="page-container py-6 text-sm text-muted-foreground">Loading…</p>}>
      <ConnectReturn />
    </Suspense>
  );
}
