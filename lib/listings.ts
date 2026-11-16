// Shared rules for listings and messages. No React in here, so it is easy to test.
// The limits match the ones in supabase/schema.sql; the database enforces them again.

import { CATEGORIES } from "./categories";

export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  seller_email: string;
  image_path: string; // the photo's file name in the "listing-images" bucket
  location: string;
  created_at: string;
  sold?: boolean; // set by the Stripe webhook once someone buys it
};

export const LIMITS = {
  title: 100,
  description: 2000,
  location: 100,
  email: 254,
  message: 1000,
  maxPrice: 1_000_000,
} as const;

// ---------- photos ----------
export const IMAGE_BUCKET = "listing-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
// Only these types are allowed (no SVG: it can carry scripts). The value is the
// file ending we save the photo with.
export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

// A friendly error if the file isn't allowed, or null if it is.
export function checkImage(file: { type: string; size: number }): string | null {
  if (!(file.type in IMAGE_EXTENSIONS)) {
    return "Please choose a JPG, PNG, GIF or WebP image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "That photo is too big. Please choose one under 5 MB.";
  }
  return null;
}

// ---------- email ----------
export function isValidEmail(email: string): boolean {
  return email.length <= LIMITS.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// ---------- price ----------
// Turns what someone typed ("120", "$1,200", "12.50") into a number, or null if
// it isn't a sensible price. At most 2 decimals, between 0 and 1,000,000.
export function parsePrice(text: string): number | null {
  const cleaned = text.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value <= LIMITS.maxPrice ? value : null;
}

// 0 shows as "Free"; whole dollars as "$99"; otherwise "$12.50".
export function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
}

// ---------- time ----------
// "just now", "5 minutes ago", "2 hours ago", "3 days ago", or a date after a week.
export function listedAgo(createdAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return `on ${new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// ---------- the "create listing" form ----------
export type ListingForm = {
  title: string;
  category: string;
  price: string;
  location: string;
  email: string;
  description: string;
  hasPhoto: boolean;
};
export type ListingErrors = Partial<Record<keyof ListingForm, string>>;

// Returns one friendly message per field that has a problem. Empty = all good.
export function validateListing(form: ListingForm): ListingErrors {
  const errors: ListingErrors = {};
  if (!form.hasPhoto) errors.hasPhoto = "Please add a photo.";

  const title = form.title.trim();
  if (title.length === 0) errors.title = "Please enter a title.";
  else if (title.length > LIMITS.title) errors.title = `The title can be at most ${LIMITS.title} characters.`;

  if (!CATEGORIES.some((c) => c.slug === form.category)) errors.category = "Please choose a category.";

  if (form.price.trim() === "") errors.price = "Please enter a price (0 for free).";
  else if (parsePrice(form.price) === null) errors.price = "Please enter a price like 120 or 12.50.";

  if (form.location.trim().length > LIMITS.location) errors.location = `The location can be at most ${LIMITS.location} characters.`;

  const email = form.email.trim();
  if (email.length === 0) errors.email = "Please enter your contact email.";
  else if (!isValidEmail(email)) errors.email = "That doesn't look like an email address.";

  if (form.description.length > LIMITS.description) errors.description = `The description can be at most ${LIMITS.description} characters.`;
  return errors;
}

// ---------- the "message seller" form ----------
export type MessageErrors = Partial<Record<"email" | "message", string>>;
export function validateMessage(form: { email: string; message: string }): MessageErrors {
  const errors: MessageErrors = {};
  const email = form.email.trim();
  if (email.length === 0) errors.email = "Please enter your email so the seller can reply.";
  else if (!isValidEmail(email)) errors.email = "That doesn't look like an email address.";

  const message = form.message.trim();
  if (message.length === 0) errors.message = "Please write a message.";
  else if (message.length > LIMITS.message) errors.message = `The message can be at most ${LIMITS.message} characters.`;
  return errors;
}

// A listing's id is a UUID. We check before asking the database, so a made-up
// address like /item/hello shows "not found" instead of an error.
export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
