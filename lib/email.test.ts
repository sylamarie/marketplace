import { describe, expect, it, vi } from "vitest";

import { DEFAULT_API_URL, buildSellerEmail, sendEmail } from "./email";
import { createLimiter } from "./rate-limit";

describe("buildSellerEmail", () => {
  const base = { title: "Mountain bike", listingUrl: "https://example.com/item/1", buyerEmail: "buyer@example.com", message: "  Is this still available?  " };

  it("puts the listing, the buyer and the message in the email", () => {
    const { subject, text } = buildSellerEmail(base);
    expect(subject).toBe('New message about "Mountain bike"');
    expect(text).toContain("buyer@example.com");
    expect(text).toContain("Is this still available?");
    expect(text).toContain("https://example.com/item/1");
  });

  it("trims the message", () => {
    expect(buildSellerEmail(base).text).not.toContain("  Is this");
  });

  it("cannot be tricked into adding email headers through a title with line breaks", () => {
    const { subject } = buildSellerEmail({ ...base, title: "Bike\r\nBcc: victim@example.com\nSubject: hacked" });
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toBe('New message about "Bike Bcc: victim@example.com Subject: hacked"');
  });

  it("shortens a very long title in the subject", () => {
    const { subject } = buildSellerEmail({ ...base, title: "x".repeat(500) });
    expect(subject.length).toBeLessThan(120);
  });

  it("is plain text: HTML typed by a buyer stays as harmless text", () => {
    const { text } = buildSellerEmail({ ...base, message: "<script>alert(1)</script>" });
    expect(text).toContain("<script>alert(1)</script>"); // shown as-is, in a plain-text email
  });
});

describe("sendEmail", () => {
  const config = { apiKey: "secret-key", from: "Marketplace <onboarding@resend.dev>" };
  const input = { to: "seller@example.com", replyTo: "buyer@example.com", subject: "Hi", text: "Body" };

  it("sends the right request to the email service", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const result = await sendEmail(config, input, fake as unknown as typeof fetch);
    expect(result).toEqual({ ok: true });

    const [url, options] = fake.mock.calls[0];
    expect(url).toBe(DEFAULT_API_URL);
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer secret-key");
    expect(JSON.parse(options.body)).toEqual({
      from: "Marketplace <onboarding@resend.dev>",
      to: ["seller@example.com"],
      reply_to: "buyer@example.com",
      subject: "Hi",
      text: "Body",
    });
  });

  it("reports a refusal (for example the service only allows your own address)", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("{}", { status: 403 }));
    const result = await sendEmail(config, input, fake as unknown as typeof fetch);
    expect(result).toEqual({ ok: false, reason: "the email service answered HTTP 403" });
  });

  it("reports no connection, and never throws", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await sendEmail(config, input, fake as unknown as typeof fetch);
    expect(result).toEqual({ ok: false, reason: "the email service could not be reached" });
  });

  it("never puts the secret key in the failure reason", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("secret-key leaked?", { status: 500 }));
    const result = await sendEmail(config, input, fake as unknown as typeof fetch);
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });
});

describe("createLimiter", () => {
  it("allows up to the limit, then says no", () => {
    const limiter = createLimiter({ max: 3, windowMs: 1000, now: () => 0 });
    expect([1, 2, 3, 4, 5].map(() => limiter.allow("a"))).toEqual([true, true, true, false, false]);
  });

  it("counts each key separately", () => {
    const limiter = createLimiter({ max: 1, windowMs: 1000, now: () => 0 });
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("b")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
  });

  it("lets requests through again once the time window has passed", () => {
    let time = 0;
    const limiter = createLimiter({ max: 1, windowMs: 1000, now: () => time });
    expect(limiter.allow("a")).toBe(true);
    time = 999;
    expect(limiter.allow("a")).toBe(false);
    time = 1000;
    expect(limiter.allow("a")).toBe(true);
  });

  it("does not remember an unlimited number of keys", () => {
    const limiter = createLimiter({ max: 1, windowMs: 1_000_000, maxKeys: 10, now: () => 0 });
    for (let i = 0; i < 100; i++) limiter.allow("key" + i);
    expect(limiter.allow("key99")).toBe(false); // a recent one is still remembered
  });
});
