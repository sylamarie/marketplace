import { Suspense } from "react";

import { PurchaseSuccess } from "@/components/purchase-success";

export const metadata = { title: "Purchase successful · Marketplace" };

// Stripe sends buyers here after they pay. The Suspense wrapper shows "Loading…"
// while the page reads the address it was opened with.
export default function PurchaseSuccessPage() {
  return (
    <Suspense fallback={<p className="page-container py-6 text-sm text-muted-foreground">Loading…</p>}>
      <PurchaseSuccess />
    </Suspense>
  );
}
