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
  text: string; // plain-text version (for email programs that don't show HTML)
  html?: string; // the designed version
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

// Makes text safe to put inside HTML. Everything a buyer types goes through this,
// so "<script>" arrives as harmless visible text, never as code or a link.
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type SellerEmailInput = {
  title: string;
  listingUrl: string;
  buyerEmail: string;
  message: string;
  priceText?: string; // e.g. "$49.99" or "Free"
  categoryLabel?: string; // e.g. "Electronics"
  imageUrl?: string | null; // the listing's photo, if any
};

// The plain-text version.
function buildText(input: SellerEmailInput): string {
  return [
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
  ].join("\n");
}

// The designed version. Email programs are old-fashioned, so this uses tables and
// inline styles (the only things every program understands), a 600px column that
// shrinks on phones, and no scripts. Every piece of text from a person is escaped.
function buildHtml(input: SellerEmailInput): string {
  const title = escapeHtml(oneLine(input.title, 100));
  const buyer = escapeHtml(oneLine(input.buyerEmail, 254));
  const listingUrl = escapeHtml(input.listingUrl);
  const previewText = escapeHtml(oneLine(input.message, 100));

  // Keep the buyer's line breaks, but never more than one blank line in a row.
  const messageHtml = escapeHtml(input.message.trim())
    .replace(/\r\n|\r|\n/g, "<br>")
    .replace(/(<br>){3,}/g, "<br><br>");

  // The Reply button opens a new email to the buyer, with a subject already filled in.
  const mailto = escapeHtml(
    `mailto:${encodeURIComponent(input.buyerEmail).replace(/%40/g, "@")}?subject=${encodeURIComponent("Re: " + oneLine(input.title, 80))}`,
  );

  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const details = [input.priceText, input.categoryLabel].filter(Boolean).map((t) => escapeHtml(String(t))).join(" &middot; ");

  const photo = input.imageUrl
    ? `<td width="96" valign="top" style="padding:0 16px 0 0;">
         <img src="${escapeHtml(input.imageUrl)}" width="96" alt="Photo of ${title}" style="display:block;width:96px;height:auto;border-radius:8px;border:1px solid #e4e6eb;">
       </td>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>New message about ${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${previewText}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f5;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

    <tr><td style="padding:0 4px 16px 4px;font-family:${font};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;background:#2563eb;border-radius:18px;color:#ffffff;font-family:${font};font-size:20px;font-weight:700;line-height:36px;">M</td>
        <td style="padding-left:10px;font-family:${font};font-size:20px;font-weight:700;color:#1c1e21;">Marketplace</td>
      </tr></table>
    </td></tr>

    <tr><td style="background:#ffffff;border:1px solid #e4e6eb;border-radius:12px;padding:28px 24px;font-family:${font};color:#1c1e21;">

      <h1 style="margin:0 0 6px 0;font-size:22px;line-height:28px;font-weight:700;color:#1c1e21;">You have a new message</h1>
      <p style="margin:0 0 20px 0;font-size:15px;line-height:22px;color:#65676b;">Someone is interested in your listing.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f8fa;border:1px solid #e4e6eb;border-radius:10px;">
        <tr><td style="padding:14px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            ${photo}
            <td valign="top" style="font-family:${font};">
              <div style="font-size:16px;line-height:22px;font-weight:700;color:#1c1e21;">${title}</div>
              ${details ? `<div style="margin-top:4px;font-size:14px;line-height:20px;color:#65676b;">${details}</div>` : ""}
            </td>
          </tr></table>
        </td></tr>
      </table>

      <p style="margin:24px 0 8px 0;font-size:13px;line-height:18px;color:#65676b;">Message from <strong style="color:#1c1e21;">${buyer}</strong></p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="border-left:4px solid #2563eb;background:#eef3fd;border-radius:4px;padding:14px 16px;font-family:${font};font-size:16px;line-height:24px;color:#1c1e21;">${messageHtml}</td>
      </tr></table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;"><tr>
        <td align="center" bgcolor="#2563eb" style="border-radius:8px;">
          <a href="${mailto}" style="display:inline-block;padding:13px 26px;font-family:${font};font-size:16px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">Reply to buyer</a>
        </td>
      </tr></table>
      <p style="margin:14px 0 0 0;font-size:14px;line-height:20px;color:#65676b;">Or just press <strong>Reply</strong> in your email program: your answer goes straight to the buyer.</p>

      <p style="margin:24px 0 0 0;font-size:14px;line-height:20px;"><a href="${listingUrl}" style="color:#2563eb;text-decoration:underline;">See your listing</a></p>
    </td></tr>

    <tr><td style="padding:16px 8px 0 8px;font-family:${font};font-size:12px;line-height:18px;color:#8a8d91;text-align:center;">
      You are getting this email because your address is on a Marketplace listing. If you did not expect it, you can ignore it.
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// Builds the subject, the plain-text version and the designed (HTML) version.
export function buildSellerEmail(input: SellerEmailInput): { subject: string; text: string; html: string } {
  return {
    subject: `New message about "${oneLine(input.title, 80)}"`,
    text: buildText(input),
    html: buildHtml(input),
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
        ...(input.html ? { html: input.html } : {}),
      }),
      signal: AbortSignal.timeout(8000), // don't make the buyer wait forever
    });
    if (!response.ok) return { ok: false, reason: `the email service answered HTTP ${response.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "the email service could not be reached" };
  }
}
