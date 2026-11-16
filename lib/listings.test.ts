import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CATEGORIES, categoryName } from "./categories";
import {
  LIMITS,
  MAX_IMAGE_BYTES,
  checkImage,
  formatPrice,
  isUuid,
  isValidEmail,
  listedAgo,
  parsePrice,
  validateListing,
  validateMessage,
  type ListingForm,
} from "./listings";

const goodForm: ListingForm = {
  title: "Bike 24 inch",
  category: "sporting-goods",
  price: "99",
  location: "Campus",
  email: "seller@example.com",
  description: "Good condition",
  hasPhoto: true,
};

describe("categories", () => {
  it("has a unique slug for every category", () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("matches the list in supabase/schema.sql exactly", () => {
    // If someone adds a category in the code but not in the database (or the
    // other way round), listings in that category would be refused. This catches it.
    const sql = fs.readFileSync(path.join(__dirname, "../supabase/schema.sql"), "utf8");
    const block = sql.match(/category\s+text\s+not null check \(category in \(([\s\S]*?)\)\)/);
    expect(block).not.toBeNull();
    const inSql = [...block![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(inSql).toEqual(CATEGORIES.map((c) => c.slug).sort());
  });

  it("finds a category's name, or falls back to the slug", () => {
    expect(categoryName("electronics")).toBe("Electronics");
    expect(categoryName("nonsense")).toBe("nonsense");
  });
});

describe("limits match the database", () => {
  it("uses the same numbers as supabase/schema.sql", () => {
    const sql = fs.readFileSync(path.join(__dirname, "../supabase/schema.sql"), "utf8");
    expect(sql).toContain(`between 1 and ${LIMITS.title})`);
    expect(sql).toContain(`char_length(description) <= ${LIMITS.description}`);
    expect(sql).toContain(`char_length(location) <= ${LIMITS.location}`);
    expect(sql).toContain(`price <= ${LIMITS.maxPrice}`);
    expect(sql).toContain(`between 1 and ${LIMITS.message})`);
    expect(sql).toContain(`<= ${LIMITS.email}`);
    expect(sql).toContain(String(MAX_IMAGE_BYTES));
  });
});

describe("parsePrice", () => {
  it("understands normal prices", () => {
    expect(parsePrice("120")).toBe(120);
    expect(parsePrice("12.50")).toBe(12.5);
    expect(parsePrice("$1,200")).toBe(1200);
    expect(parsePrice("0")).toBe(0);
    expect(parsePrice(" 99 ")).toBe(99);
    expect(parsePrice("1000000")).toBe(1_000_000);
  });

  it("rejects things that are not a price", () => {
    for (const text of ["", "abc", "-5", "12.345", "1e5", "12,5,0.", "$", "1 000", "0x10", "Infinity", "1000000.01", "99999999999"]) {
      expect(parsePrice(text), JSON.stringify(text)).toBeNull();
    }
  });
});

describe("formatPrice", () => {
  it("shows Free, whole dollars, and cents", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(99)).toBe("$99");
    expect(formatPrice(12.5)).toBe("$12.50");
    expect(formatPrice(1234)).toBe("$1,234");
  });
});

describe("isValidEmail", () => {
  it("accepts normal addresses", () => {
    for (const e of ["a@b.co", "first.last+tag@mail.example.co.uk", "A@B.IO"]) expect(isValidEmail(e), e).toBe(true);
  });
  it("rejects broken ones", () => {
    for (const e of ["", "no-at", "a@b", "a b@c.com", "@c.com", "a@.com", "a@@c.com", "a@c .com", "x".repeat(250) + "@c.com"]) {
      expect(isValidEmail(e), e).toBe(false);
    }
  });
});

describe("validateListing", () => {
  it("accepts a good form", () => {
    expect(validateListing(goodForm)).toEqual({});
  });

  it("accepts a free item and an empty description and location", () => {
    expect(validateListing({ ...goodForm, price: "0", description: "", location: "" })).toEqual({});
  });

  it("asks for each missing required field", () => {
    const errors = validateListing({ title: "  ", category: "", price: "", location: "", email: "", description: "", hasPhoto: false });
    expect(Object.keys(errors).sort()).toEqual(["category", "email", "hasPhoto", "price", "title"]);
  });

  it("enforces the length limits", () => {
    expect(validateListing({ ...goodForm, title: "t".repeat(LIMITS.title) })).toEqual({});
    expect(validateListing({ ...goodForm, title: "t".repeat(LIMITS.title + 1) }).title).toBeDefined();
    expect(validateListing({ ...goodForm, description: "d".repeat(LIMITS.description + 1) }).description).toBeDefined();
    expect(validateListing({ ...goodForm, location: "l".repeat(LIMITS.location + 1) }).location).toBeDefined();
  });

  it("rejects an unknown category, a bad price and a bad email", () => {
    expect(validateListing({ ...goodForm, category: "weapons" }).category).toBeDefined();
    expect(validateListing({ ...goodForm, price: "cheap" }).price).toBeDefined();
    expect(validateListing({ ...goodForm, email: "nope" }).email).toBeDefined();
  });
});

describe("validateMessage", () => {
  it("accepts a good message", () => {
    expect(validateMessage({ email: "buyer@example.com", message: "Is this still available?" })).toEqual({});
  });
  it("asks for both fields", () => {
    expect(Object.keys(validateMessage({ email: "", message: "   " })).sort()).toEqual(["email", "message"]);
  });
  it("enforces the message limit", () => {
    expect(validateMessage({ email: "a@b.co", message: "m".repeat(LIMITS.message) })).toEqual({});
    expect(validateMessage({ email: "a@b.co", message: "m".repeat(LIMITS.message + 1) }).message).toBeDefined();
  });
});

describe("checkImage", () => {
  it("accepts JPG, PNG, GIF and WebP up to 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/gif", "image/webp"]) expect(checkImage({ type, size: 1000 })).toBeNull();
    expect(checkImage({ type: "image/png", size: MAX_IMAGE_BYTES })).toBeNull();
  });
  it("rejects a photo one byte over 5 MB", () => {
    expect(checkImage({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toMatch(/too big/);
  });
  it("rejects other file types, including SVG", () => {
    for (const type of ["image/svg+xml", "text/html", "application/pdf", ""]) expect(checkImage({ type, size: 1000 })).toMatch(/JPG, PNG, GIF or WebP/);
  });
});

describe("isUuid", () => {
  it("recognises listing ids", () => {
    expect(isUuid("0a92e90e-78b9-432e-8b2b-1d54abd5f1a2")).toBe(true);
    expect(isUuid("hello")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("0a92e90e-78b9-432e-8b2b-1d54abd5f1a2/../x")).toBe(false);
  });
});

describe("listedAgo", () => {
  const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);
  const ago = (ms: number) => new Date(NOW - ms).toISOString();
  const minutes = (m: number) => ago(m * 60_000);

  it('says "just now" in the first minute, and for a clock that is slightly off', () => {
    expect(listedAgo(ago(0), NOW)).toBe("just now");
    expect(listedAgo(ago(-90_000), NOW)).toBe("just now");
  });
  it("counts minutes, hours and days, with the right singular and plural", () => {
    expect(listedAgo(minutes(1), NOW)).toBe("1 minute ago");
    expect(listedAgo(minutes(5), NOW)).toBe("5 minutes ago");
    expect(listedAgo(minutes(60), NOW)).toBe("1 hour ago");
    expect(listedAgo(minutes(180), NOW)).toBe("3 hours ago");
    expect(listedAgo(minutes(60 * 24), NOW)).toBe("1 day ago");
    expect(listedAgo(minutes(60 * 24 * 3), NOW)).toBe("3 days ago");
  });
  it("switches to a date after a week", () => {
    expect(listedAgo(minutes(60 * 24 * 10), NOW)).toMatch(/^on [A-Z][a-z]{2} \d+$/);
  });
});
