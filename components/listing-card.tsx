import Link from "next/link";

import { Photo } from "@/components/photo";
import { categoryName } from "@/lib/categories";
import { formatPrice, type Listing } from "@/lib/listings";

// One item in the grid on the home page. Click it to open the listing.
export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/item/${listing.id}`}
      className="group block overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="aspect-square overflow-hidden bg-muted">
        <Photo
          path={listing.image_path}
          alt={listing.title}
          className="size-full object-cover transition group-hover:scale-105"
        />
      </div>
      <div className="p-3">
        <p className="text-base font-bold">{formatPrice(Number(listing.price))}</p>
        <p className="truncate text-sm">{listing.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {listing.location || categoryName(listing.category)}
        </p>
      </div>
    </Link>
  );
}
