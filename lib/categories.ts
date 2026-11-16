// The categories a listing can have. "slug" is what we save in the database
// (it must match the list in supabase/schema.sql, and a test checks that it does).
export const CATEGORIES = [
  { slug: "vehicles", name: "Vehicles" },
  { slug: "property-rentals", name: "Property Rentals" },
  { slug: "apparel", name: "Apparel" },
  { slug: "classifieds", name: "Classifieds" },
  { slug: "electronics", name: "Electronics" },
  { slug: "entertainment", name: "Entertainment" },
  { slug: "family", name: "Family" },
  { slug: "free-stuff", name: "Free Stuff" },
  { slug: "garden-outdoor", name: "Garden & Outdoor" },
  { slug: "hobbies", name: "Hobbies" },
  { slug: "home-goods", name: "Home Goods" },
  { slug: "home-improvement", name: "Home Improvement" },
  { slug: "home-sales", name: "Home Sales" },
  { slug: "musical-instruments", name: "Musical Instruments" },
  { slug: "office-supplies", name: "Office Supplies" },
  { slug: "pet-supplies", name: "Pet Supplies" },
  { slug: "sporting-goods", name: "Sporting Goods" },
  { slug: "toys-games", name: "Toys & Games" },
  { slug: "buy-sell-groups", name: "Buy and sell groups" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function categoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}
