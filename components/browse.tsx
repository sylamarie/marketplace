"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CategorySidebar, CategoryTabs } from "@/components/category-nav";
import { ListingCard } from "@/components/listing-card";
import { Input } from "@/components/ui/input";
import { categoryName } from "@/lib/categories";
import type { Listing } from "@/lib/listings";
import { supabase } from "@/lib/supabase";

type Status = "loading" | "ready" | "error" | "unconfigured";
const LOAD_LIMIT = 200; // how many of the newest listings we load

// The home page: all listings in a grid, with category filters and keyword search.
export function Browse() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [status, setStatus] = useState<Status>(supabase ? "loading" : "unconfigured");
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // On load: fetch the newest listings once. Filtering then happens in the
  // browser, so changing a category or typing in the search box is instant.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;

    async function load() {
      const { data, error } = await client
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LOAD_LIMIT);
      if (cancelled) return;
      if (error) {
        console.error("Could not load listings:", error.message);
        setStatus("error");
        return;
      }
      setListings(data as Listing[]);
      setStatus("ready");
    }
    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings.filter(
      (l) =>
        (category === null || l.category === category) &&
        (q === "" ||
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          categoryName(l.category).toLowerCase().includes(q)),
    );
  }, [listings, category, query]);

  const heading = category ? categoryName(category) : "Today's picks";

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 content-start gap-6 px-4 py-6 lg:grid-cols-[16rem_1fr]">
      {/* Big screens: categories in a sidebar */}
      <div className="hidden lg:block">
        <div className="sticky top-20">
          <CategorySidebar selected={category} onSelect={setCategory} />
        </div>
      </div>

      <section aria-labelledby="listings-heading" className="min-w-0">
        <h1 id="listings-heading" className="mb-3 text-2xl font-bold">
          {heading}
        </h1>

        <div className="relative mb-4">
          <label htmlFor="search" className="sr-only">
            Search listings
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search listings…"
            className="h-10 bg-card pl-9"
          />
        </div>

        {/* Phones and tablets: categories as tabs you can swipe */}
        <div className="mb-4 lg:hidden">
          <CategoryTabs selected={category} onSelect={setCategory} />
        </div>

        {status === "unconfigured" && (
          <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            This marketplace isn&apos;t connected to Supabase yet. Copy <code>.env.local.example</code> to{" "}
            <code>.env.local</code>, add your two Supabase values, then restart <code>npm run dev</code>.
          </p>
        )}
        {status === "loading" && <p className="text-sm text-muted-foreground">Loading listings…</p>}
        {status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            Sorry, the listings could not be loaded. Please refresh the page.
          </p>
        )}
        {status === "ready" && listings.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing here yet. Be the first to create a listing!</p>
        )}
        {status === "ready" && listings.length > 0 && visible.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No listings match{query.trim() ? ` “${query.trim()}”` : ""}
            {category ? ` in ${categoryName(category)}` : ""}.
          </p>
        )}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
          {visible.map((listing) => (
            <li key={listing.id}>
              <ListingCard listing={listing} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
