// Sending the "you have a new message" email to a seller. Server-side only: it
// uses a secret key, which must never reach the browser. No React in here.

export type EmailConfig = {
  apiKey: string; // the secret key from the email service (never NEXT_PUBLIC_)
  from: string; // e.g. "Marketplace <onboarding@resend.dev>"
  apiUrl?: string; // only changed in tests
};

export type EmailInput = {
  to: string; // always the seller's address saved on the listing, never typed in by the buyer
  replyTo: string; // the buyer, so the seller can just press Reply
  subject: string;
  text: string;
};

export type EmailResult = { ok: true } | { ok: false; reason: string };

export const DEFAULT_FROM = "Marketplace <onboarding@resend.dev>";
export const DEFAULT_API_URL = "https://api.resend.com/emails";

// Turns text into a single clean line. Without this, a title with a hidden line
// break could try to sneak extra lines into the email's headers.
function oneLine(text: string, maxLength: number): string {
  // Every control character (codes 0 to 31 and 127) and the two Unicode line
  // separators (codes 8232 and 8233) become a plain space. Codes are used
  // instead of a pattern, so no invisible characters need to sit in this file.
  let spaced = "";
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    const isControl = code < 32 || code === 127 || code === 8232 || code === 8233;
    spaced += isControl ? " " : character;
  }
  const cleaned = spaced.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength - 3) + "..." : cleaned;
}

// Builds the subject and the plain-text body. It is plain text on purpose, so
// nothing a buyer types can turn into HTML or a hidden link.
export function buildSellerEmail(input: {
  title: string;
  listingUrl: string;
  buyerEmail: string;
  message: string;
}): { subject: string; text: string } {
  return {
    subject: `New message about "${oneLine(input.title, 80)}"`,
    text: [
      "Someone sent you a message about your listing on Marketplace.",
      "",
      `Listing: ${oneLine(input.title, 100)}`,
      `From: ${oneLine(input.buyerEmail, 254)}`,
      "",
      "Message:",
      input.message.trim(),
      "",
      `To reply, press Reply: your answer goes straight to ${oneLine(input.buyerEmail, 254)}.`,
      `See your listing: ${input.listingUrl}`,
    ].join("\n"),
  };
}

// Sends one email through Resend's API. It never throws: it tells you whether it
// worked, so a problem with email can never stop the message from being saved.
export async function sendEmail(
  config: EmailConfig,
  input: EmailInput,
  fetchImpl: typeof fetch = fetch,
): Promise<EmailResult> {
  try {
    const response = await fetchImpl(config.apiUrl ?? DEFAULT_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        reply_to: input.replyTo,
        subject: input.subject,
        text: input.text,
      }),
      signal: AbortSignal.timeout(8000), // don't make the buyer wait forever
    });
    if (!response.ok) return { ok: false, reason: `the email service answered HTTP ${response.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "the email service could not be reached" };
  }
}
