"use client";

import { CreditCard, Tag, User, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

// A menu item for something that needs accounts (which this site doesn't have
// yet), so it is shown but switched off, with a "Coming soon" note. It is not a
// link, so nobody ends up on a page that doesn't exist.
function SoonItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div aria-disabled="true" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap text-muted-foreground">
      <Icon aria-hidden className="size-4 shrink-0" />
      <span>{label}</span>
      {/* The tag says "Soon" so it always fits on one line; screen readers hear "Coming soon". */}
      <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">
        <span aria-hidden>Soon</span>
        <span className="sr-only">Coming soon</span>
      </span>
    </div>
  );
}

type Props = {
  selected: string | null; // the category slug, or null for "all"
  onSelect: (slug: string | null) => void;
};

const itemClass = (active: boolean) =>
  cn(
    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring",
    active ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted",
  );

// Categories as a sidebar on big screens...
export function CategorySidebar({ selected, onSelect }: Props) {
  return (
    // The list is taller than most screens, so the card itself scrolls (with a thin
    // scrollbar inside it) and every category can be reached.
    <nav
      aria-label="Categories"
      className="max-h-[calc(100svh-6rem)] overflow-y-auto rounded-xl border bg-card p-3 shadow-sm [scrollbar-width:thin]"
    >
      <h2 className="px-3 pt-1 pb-2 text-lg font-bold">Create new listing</h2>
      <ul>
        <li>
          <Link
            href="/create"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Tag aria-hidden className="size-4 text-muted-foreground" />
            Choose listing type
          </Link>
        </li>
        <li>
          <Link
            href="/connect"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CreditCard aria-hidden className="size-4 text-muted-foreground" />
            Get paid with Stripe
          </Link>
        </li>
        <li>
          <SoonItem icon={Tag} label="Your listings" />
        </li>
        <li>
          <SoonItem icon={User} label="Seller help" />
        </li>
      </ul>

      <h2 className="px-3 pt-5 pb-1 text-lg font-bold">Categories</h2>
      <ul>
        <li>
          <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)} className={itemClass(selected === null)}>
            All
          </button>
        </li>
        {CATEGORIES.map((c) => (
          <li key={c.slug}>
            <button type="button" aria-pressed={selected === c.slug} onClick={() => onSelect(c.slug)} className={itemClass(selected === c.slug)}>
              {c.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ...and as a row of tabs you can swipe sideways on phones.
export function CategoryTabs({ selected, onSelect }: Props) {
  const tab = (active: boolean) =>
    cn(
      "shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
    );
  return (
    <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 pb-1">
      <ul className="flex gap-2">
        <li>
          <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)} className={tab(selected === null)}>
            All
          </button>
        </li>
        {CATEGORIES.map((c) => (
          <li key={c.slug}>
            <button type="button" aria-pressed={selected === c.slug} onClick={() => onSelect(c.slug)} className={tab(selected === c.slug)}>
              {c.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
