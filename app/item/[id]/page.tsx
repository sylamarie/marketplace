import { Suspense } from "react";

import { ListingDetail } from "@/components/listing-detail";

export const metadata = { title: "Listing · Marketplace" };

// The id in the web address (/item/<id>) is read inside ListingDetail. The
// Suspense wrapper shows "Loading…" while the page gets ready.
export default function ItemPage() {
  return (
    <Suspense fallback={<p className="page-container py-6 text-sm text-muted-foreground">Loading…</p>}>
      <ListingDetail />
    </Suspense>
  );
}
