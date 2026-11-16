import { Plus } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The marketplace logo: a blue circle with an "M". (The mockup uses Facebook's
// "F" icon; we use our own so we don't copy their branding.)
export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground",
        className,
      )}
    >
      M
    </span>
  );
}

// The white bar at the top of every page. It stays in view while you scroll.
export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b bg-card shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
          <span className="text-xl font-bold tracking-tight">Marketplace</span>
        </Link>
        <Link href="/create" className={cn(buttonVariants({ size: "lg" }), "gap-1.5")}>
          <Plus aria-hidden className="size-4" />
          Create listing
        </Link>
      </div>
    </header>
  );
}
