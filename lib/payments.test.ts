import { describe, expect, it } from "vitest";

import {
  MIN_CHARGE_CENTS,
  PLATFORM_FEE_PERCENT,
  buyState,
  isCheckoutSessionId,
  isStripeAccountId,
  normalizeEmail,
  platformFee,
  toCents,
} from "./payments";

describe("toCents", () => {
  it("turns dollars into whole cents", () => {
    expect(toCents(25)).toBe(2500);
    expect(toCents(12.5)).toBe(1250);
    expect(toCents(0.5)).toBe(50);
    expect(toCents(0)).toBe(0);
  });

  it("is not thrown off by decimal rounding errors", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(1_000_000)).toBe(100_000_000);
  });
});

describe("platformFee", () => {
  it("is 10% by default", () => {
    expect(PLATFORM_FEE_PERCENT).toBe(10);
    expect(platformFee(2500)).toBe(250);
    expect(platformFee(10_000)).toBe(1000);
  });

  it("rounds to a whole cent", () => {
    expect(platformFee(1999)).toBe(200); // 199.9 -> 200
    expect(platformFee(55)).toBe(6); // 5.5 -> 6
    expect(platformFee(MIN_CHARGE_CENTS)).toBe(5);
  });

  it("never takes more than the sale or a negative amount", () => {
    for (const cents of [50, 99, 1234, 99_999]) {
      const fee = platformFee(cents);
      expect(fee).toBeGreaterThanOrEqual(0);
      expect(fee).toBeLessThan(cents);
    }
  });
});

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Sam@Mail.COM ")).toBe("sam@mail.com");
  });
});

describe("Stripe id checks", () => {
  it("accepts real-looking account ids only", () => {
    expect(isStripeAccountId("acct_1RkvpmPve7jegfGD")).toBe(true);
    expect(isStripeAccountId("acct_")).toBe(false);
    expect(isStripeAccountId("cus_1RkvpmPve7jegfGD")).toBe(false);
    expect(isStripeAccountId("acct_1Rkvpm/../etc")).toBe(false);
    expect(isStripeAccountId("")).toBe(false);
  });

  it("accepts real-looking checkout session ids only", () => {
    expect(isCheckoutSessionId("cs_test_FAKEsessionIdForTestsOnly1234567890")).toBe(true);
    expect(isCheckoutSessionId("cs_test_short")).toBe(false);
    expect(isCheckoutSessionId("pi_3RkvXRLO59EL2N5v08a1NNqm")).toBe(false);
    expect(isCheckoutSessionId("cs_test_FAKEsession IdForTestsOnly1234567890")).toBe(false);
  });
});

describe("buyState", () => {
  it("offers Buy now for an unsold item from a ready seller", () => {
    expect(buyState({ price: 25 }, true)).toBe("buyable");
    expect(buyState({ price: 25, sold: false }, true)).toBe("buyable");
  });

  it("says sold first, whatever else is true", () => {
    expect(buyState({ price: 25, sold: true }, true)).toBe("sold");
    expect(buyState({ price: 25, sold: true }, false)).toBe("sold");
  });

  it("does not sell for a seller who hasn't finished onboarding", () => {
    expect(buyState({ price: 25 }, false)).toBe("seller-not-ready");
  });

  it("does not sell free items or ones under 50 cents", () => {
    expect(buyState({ price: 0 }, true)).toBe("too-cheap");
    expect(buyState({ price: 0.49 }, true)).toBe("too-cheap");
    expect(buyState({ price: 0.5 }, true)).toBe("buyable");
  });
});
