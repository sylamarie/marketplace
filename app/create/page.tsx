import { Building2, Car, Layers, Tag } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const TYPES = [
  { name: "Item for sale", text: "Create a single listing for one or more items to sell.", icon: Tag, href: "/create/item" },
  { name: "Create multiple listings", text: "Quickly create several listings at the same time.", icon: Layers, href: null },
  { name: "Vehicle for sale", text: "Sell a car, truck or other type of vehicle.", icon: Car, href: null },
  { name: "Home for sale or rent", text: "List a house or apartment for sale or rent.", icon: Building2, href: null },
] as const;

export const metadata = { title: "Choose listing type · Marketplace" };

// Step 1 of creating a listing: choose what kind. Only "Item for sale" works so
// far, and the others are marked "Coming soon".
export default function ChooseListingType() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-center text-2xl font-bold">Choose listing type</h1>
      <p className="mt-1 mb-6 text-center text-sm text-muted-foreground">What would you like to list today?</p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TYPES.map(({ name, text, icon: Icon, href }) => {
          const card = (
            <div
              className={cn(
                "flex h-full flex-col items-center rounded-xl border bg-card p-6 text-center shadow-sm",
                href ? "transition hover:-translate-y-0.5 hover:shadow-md" : "opacity-60",
              )}
            >
              <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon aria-hidden className="size-7" />
              </span>
              <h2 className="font-semibold">{name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              {!href && <p className="mt-3 text-xs font-medium text-muted-foreground">Coming soon</p>}
            </div>
          );
          return (
            <li key={name}>
              {href ? (
                <Link href={href} className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
                  {card}
                </Link>
              ) : (
                <div aria-disabled="true">{card}</div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
