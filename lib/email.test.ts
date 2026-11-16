import { describe, expect, it, vi } from "vitest";

import { DEFAULT_API_URL, buildSellerEmail, escapeHtml, sendEmail } from "./email";
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

describe("escapeHtml", () => {
  it("turns the five special characters into harmless text", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe("&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });
});

describe("the designed (HTML) email", () => {
  const base = {
    title: "Mountain bike",
    listingUrl: "https://example.com/item/1",
    buyerEmail: "buyer@example.com",
    message: "Is this still available?",
    priceText: "$120",
    categoryLabel: "Sporting Goods",
    imageUrl: "https://project.supabase.co/storage/v1/object/public/listing-images/abc.jpg",
  };
  const html = (o = {}) => buildSellerEmail({ ...base, ...o }).html;

  it("shows the listing, the price, the category, the buyer and the message", () => {
    const h = html();
    for (const piece of ["Mountain bike", "$120", "Sporting Goods", "buyer@example.com", "Is this still available?", "You have a new message", "Reply to buyer", "https://example.com/item/1"]) {
      expect(h, piece).toContain(piece);
    }
  });

  it("shows the photo only when there is one", () => {
    expect(html()).toContain('<img src="https://project.supabase.co/');
    expect(html({ imageUrl: null })).not.toContain("<img");
  });

  it("has no scripts, forms, external style sheets or javascript: links", () => {
    const h = html();
    expect(h).not.toMatch(/<script|<form|<link|<iframe|javascript:/i);
  });

  it("is small enough that email programs will not cut it off (they clip around 100 KB)", () => {
    expect(html().length).toBeLessThan(20_000);
  });

  it("keeps the buyer's line breaks, but never more than one blank line in a row", () => {
    const h = html({ message: "Line one\nLine two\n\n\n\n\nLine three" });
    expect(h).toContain("Line one<br>Line two<br><br>Line three");
  });

  it("puts the start of the message in the inbox preview", () => {
    expect(html({ message: "Is this still available? I can pick it up today." })).toContain("Is this still available? I can pick it up today.</div>");
  });

  describe("cannot be used to sneak code or links into a seller's inbox", () => {
    it("escapes HTML in the message", () => {
      const h = html({ message: '<script>alert(1)</script><img src=x onerror=alert(1)><a href="https://evil.example">click</a>' });
      expect(h).not.toContain("<script>alert(1)");
      expect(h).not.toContain("<img src=x");
      expect(h).not.toContain('<a href="https://evil.example"');
      expect(h).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    });

    it("escapes HTML in the title, in the HTML and in the subject-line preview", () => {
      const h = html({ title: '<b onmouseover="x">Bike</b>' });
      expect(h).not.toContain("<b onmouseover");
      expect(h).toContain("&lt;b onmouseover=&quot;x&quot;&gt;Bike&lt;/b&gt;");
    });

    it("escapes the price and category text too", () => {
      const h = html({ priceText: "<i>free</i>", categoryLabel: "<u>x</u>" });
      expect(h).not.toMatch(/<i>free|<u>x/);
    });

    it("cannot break out of the Reply button's link with quotes in the buyer's address", () => {
      const h = html({ buyerEmail: 'a"onmouseover="alert(1)@b.co' });
      expect(h).not.toMatch(/onmouseover="/);
      expect(h).toContain("mailto:a%22onmouseover%3D%22alert(1)@b.co");
    });

    it("cannot break out of the photo's address with quotes", () => {
      const h = html({ imageUrl: 'https://x.co/a.jpg" onerror="alert(1)' });
      expect(h).not.toMatch(/onerror="alert/);
      expect(h).toContain("&quot; onerror=&quot;alert(1)");
    });

    it("does not let line breaks in the buyer's address or the title into the subject", () => {
      const { subject } = buildSellerEmail({ ...base, title: "Bike\r\nBcc: x@y.co" });
      expect(subject).not.toMatch(/[\r\n]/);
    });
  });

  it("builds a Reply button that opens an email to the buyer, with the subject filled in", () => {
    const h = html();
    expect(h).toContain("mailto:buyer@example.com?subject=Re%3A%20Mountain%20bike");
  });

  it("still includes the plain-text version, unchanged", () => {
    const { text } = buildSellerEmail(base);
    expect(text).toContain("Someone sent you a message about your listing on Marketplace.");
    expect(text).not.toContain("<");
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

  it("includes the designed version in the request when there is one", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendEmail(config, { ...input, html: "<p>Hello</p>" }, fake as unknown as typeof fetch);
    expect(JSON.parse(fake.mock.calls[0][1].body)).toMatchObject({ text: "Body", html: "<p>Hello</p>" });
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
