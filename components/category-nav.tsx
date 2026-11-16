"use client";

import { Tag } from "lucide-react";
import Link from "next/link";

import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

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
    <nav aria-label="Categories" className="rounded-xl border bg-card p-3 shadow-sm">
      <h2 className="px-3 pt-1 pb-2 text-lg font-bold">Create new listing</h2>
      <Link
        href="/create"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Tag aria-hidden className="size-4 text-muted-foreground" />
        Choose listing type
      </Link>

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
