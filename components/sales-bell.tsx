"use client";

import { Bell, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { listedAgo } from "@/lib/listings";
import { supabase } from "@/lib/supabase";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";

// One recent sale, as the database view "recent_sales" gives it (see supabase/stripe.sql).
// It only has the item, the price and the time. Never who bought it.
type Sale = { listing_id: string; item: string; amount_paid: number; currency: string; sold_at: string };

const SEEN_KEY = "marketplace:sales-seen"; // remembered in this browser only
const REFRESH_MS = 30_000;

const readSeen = (): number => {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
};
const saveSeen = (time: number) => {
  try {
    localStorage.setItem(SEEN_KEY, String(time));
  } catch {
    // private window or blocked storage: the badge just won't be remembered
  }
};

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);

// The bell in the top bar. A red number shows how many sales you haven't looked at yet;
// click the bell to see the latest sales and jump to the sold item.
export function SalesBell() {
  const now = useNow();
  const [sales, setSales] = useState<Sale[]>([]);
  const [available, setAvailable] = useState(true); // false if the view isn't set up: then no bell
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  // Load the latest sales now, and again every 30 seconds.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;

    async function load() {
      const { data, error } = await client.from("recent_sales").select("*").limit(10);
      if (cancelled) return;
      if (error) {
        setAvailable(false);
        return;
      }
      setAvailable(true);
      setSales(data as Sale[]);
      setSeen(readSeen()); // what this browser has already looked at
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Close the panel on Escape, or on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!supabase || !available) return null;

  const unseen = sales.filter((s) => Date.parse(s.sold_at) > seen).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening the panel counts as "seen": clear the red number.
    if (next && sales.length > 0) {
      const newest = Math.max(...sales.map((s) => Date.parse(s.sold_at)));
      saveSeen(newest);
      setSeen(newest);
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unseen > 0 ? `Recent sales, ${unseen} new` : "Recent sales"}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "relative flex size-9 items-center justify-center rounded-lg border bg-card transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-muted",
        )}
      >
        <Bell aria-hidden className="size-4" />
        {unseen > 0 && (
          <span
            aria-hidden
            className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] leading-5 font-bold text-white"
          >
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Recent sales"
          className="absolute top-full right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-card shadow-lg"
        >
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Recent sales</h2>
          </div>
          {sales.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No sales yet. When something sells, it shows up here.</p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto">
              {sales.map((sale) => (
                <li key={`${sale.listing_id}-${sale.sold_at}`}>
                  <Link
                    href={`/item/${sale.listing_id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                      <ShoppingBag className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words">
                        <strong className="font-semibold">{sale.item}</strong> sold for {money(Number(sale.amount_paid), sale.currency)}
                      </span>
                      <span className="block text-xs text-muted-foreground">{listedAgo(sale.sold_at, now)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
