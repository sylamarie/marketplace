// Rules for taking payments. No React and no Stripe in here, so it is easy to test.

// The marketplace keeps this share of every sale (Stripe pays the rest to the seller).
export const PLATFORM_FEE_PERCENT = 10;

// Stripe cannot charge less than 50 cents, so cheaper items (and free ones) can't be bought online.
export const MIN_CHARGE_CENTS = 50;

// Stripe works in whole cents: $12.50 becomes 1250. Rounding fixes tiny decimal errors.
export const toCents = (price: number): number => Math.round(price * 100);

// The marketplace's cut, in cents, rounded to the nearest cent.
export const platformFee = (cents: number): number => Math.round((cents * PLATFORM_FEE_PERCENT) / 100);

// Emails are matched in lower case, so "Sam@Mail.com" and "sam@mail.com" are one seller.
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

// Stripe's ids have a fixed look. We check it before using one that came from a web address.
export const isStripeAccountId = (value: string): boolean => /^acct_[A-Za-z0-9]{6,64}$/.test(value);
export const isCheckoutSessionId = (value: string): boolean => /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(value);

export type BuyState =
  | "sold" // already bought
  | "seller-not-ready" // the seller hasn't finished Stripe onboarding
  | "too-cheap" // free, or under 50 cents
  | "buyable"; // show the Buy now button

// What the listing page should offer for this item.
export function buyState(listing: { price: number; sold?: boolean }, sellerReady: boolean): BuyState {
  if (listing.sold === true) return "sold";
  if (!sellerReady) return "seller-not-ready";
  if (toCents(listing.price) < MIN_CHARGE_CENTS) return "too-cheap";
  return "buyable";
}
