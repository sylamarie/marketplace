import { MapPin } from "lucide-react";
import Link from "next/link";

import { Photo } from "@/components/photo";
import { categoryName } from "@/lib/categories";
import { formatPrice, type Listing } from "@/lib/listings";
import { cn } from "@/lib/utils";

// One item in the grid on the home page. Click it to open the listing.
export function ListingCard({ listing }: { listing: Listing }) {
  const price = Number(listing.price);
  return (
    <Link
      href={`/item/${listing.id}`}
      className="group block overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <Photo
          path={listing.image_path}
          alt={listing.title}
          className="size-full object-cover transition duration-300 group-hover:scale-105"
        />
        {price === 0 && (
          <span className="absolute top-2 left-2 rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow">
            Free
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-3">
        <p className={cn("text-base font-bold", price === 0 && "text-green-700")}>{formatPrice(price)}</p>
        <p className="truncate text-sm">{listing.title}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {listing.location ? (
            <>
              <MapPin aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{listing.location}</span>
            </>
          ) : (
            categoryName(listing.category)
          )}
        </p>
      </div>
    </Link>
  );
}

// A grey placeholder in the shape of a card, shown while listings are loading.
export function ListingCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="aspect-square animate-pulse bg-muted" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
