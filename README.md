# Marketplace

A small Facebook-style marketplace. Post an item with a photo, browse everything in a grid, filter by category, search by keyword, open a listing, and send the seller a message. Everything is saved in a **Supabase** database and photo storage.

Built with **React 19**, **Next.js**, **Supabase**, **Tailwind CSS** and **shadcn/ui**.

**Live site:** https://marketplace-syla.vercel.app

## What it does

- **Create a listing.** Upload a photo and enter a title, category, price, location (optional), contact email and description. A live preview shows how the listing will look. The photo is uploaded to Supabase Storage and the listing is saved to the database.
- **Browse.** The home page shows the newest listings in a grid. Choose a category in the sidebar (or the swipeable tabs on a phone) to filter.
- **Keyword search.** Type in the search box to filter by title, description or category.
- **Listing page.** Every listing has its own page with the large photo, price, when it was listed, category, description and the seller's email.
- **Message the seller.** Buyers enter their email and a message (quick-reply buttons included). The message is **always saved** in Supabase. If an email service is set up (see below), the seller is also **emailed**, with the buyer's address as the Reply-To so the seller can just press Reply.
- **Works on phones.** The layout adapts from a desktop sidebar to a phone-sized single column.

No login is needed.

## Run it yourself

You need [Node.js](https://nodejs.org) 20 or newer and a free [Supabase](https://supabase.com) account.

**1. Install the packages**

```bash
npm install
```

**2. Create the database.** In your Supabase project, open **SQL Editor**, click **New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**. It creates the `listings` and `messages` tables, the access rules, and the `listing-images` photo bucket. Run it **once**.

**3. Add your keys.** Copy `.env.local.example` to `.env.local` and fill in two values from your Supabase project (the green **Connect** button, or **Project Settings > API Keys**):

```
NEXT_PUBLIC_SUPABASE_URL=       # your Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # the "anon" / "publishable" key
```

Use the public key only. Never use the `service_role` or "secret" key.

**4. (Optional) Email the seller.** Without this step everything works; messages are just saved in Supabase and not emailed. To turn email on, create a free [Resend](https://resend.com) account, make an API key, and add it to `.env.local`:

```
RESEND_API_KEY=   # a SECRET: keep it out of GitHub (it is only used on the server)
EMAIL_FROM=       # optional, see below
```

Resend's free test sender (`onboarding@resend.dev`, used when `EMAIL_FROM` is empty) can only deliver to the address you signed up to Resend with. To email **any** seller, verify a domain you own in Resend and set `EMAIL_FROM` to an address on that domain, for example `Marketplace <hello@your-domain.com>`. If the email can't be sent for any reason, the message is still saved and the buyer is told so.

**5. Start it**

```bash
npm run dev
```

Then open the address it prints (usually http://localhost:3000).

Other commands:

```bash
npm run build   # make the production version
npm run lint    # check the code for problems
npm test        # run the automated tests
```

## How the data is protected

There is no login, so the database itself enforces the rules (Row Level Security in `supabase/schema.sql`):

- Anyone may **read** and **add** listings, and may **add** messages.
- Nobody can **read messages**. They contain buyers' email addresses, so they stay private. The seller reads them in the Supabase dashboard.
- Nobody can **edit or delete** anything.
- The database rejects bad data even if someone skips the website and talks to it directly: titles over 100 characters, descriptions over 2000, prices below 0 or above 1,000,000, unknown categories, malformed emails, messages over 1000 characters, and listings without a photo.
- **Photos:** only JPG, PNG, GIF or WebP up to 5 MB, saved under a random name. Nobody can list, replace or delete photos, and a listing can only point at a photo in this project's own bucket, never at another website. SVG files are refused because they can carry scripts.

The `anon` key is meant to be public. It is safe in the browser because the rules above decide what it can do.

**The message route and the email.** Messages are sent through a server route (`app/api/messages/route.ts`) so the secret email key never reaches the browser. The route:

- only accepts requests from the site itself, and checks everything again on the server (including a message size limit);
- looks up the seller's address from the saved listing, so a request can never choose where the email goes;
- saves the message first and emails second, so an email problem can never lose a message;
- sends plain text only, with line breaks stripped from the subject, so nothing a buyer types can add email headers or HTML;
- limits how fast messages can be sent (10 per visitor and 5 per listing, per 10 minutes). This limit is kept in the server's memory, so it is a best-effort guard rather than a perfect one.

Note: the seller's email is shown publicly on the listing page, as the challenge asks. Use an address you don't mind being public.

## How the code is organised

| File | What it does |
| --- | --- |
| `app/page.tsx` | The home page (renders `components/browse.tsx`). |
| `app/create/page.tsx` | Step 1 of creating a listing: choose the type. |
| `app/create/item/page.tsx` | Step 2: the form (renders `components/listing-form.tsx`). |
| `app/item/[id]/page.tsx` | A single listing (renders `components/listing-detail.tsx`). |
| `components/browse.tsx` | The grid, category filter and search. |
| `components/listing-form.tsx` | The create-listing form with the photo picker and live preview. |
| `components/listing-detail.tsx` | The listing page and the "message seller" form. |
| `app/api/messages/route.ts` | Saves a message, then emails the seller. |
| `lib/email.ts` | Builds and sends the email. |
| `lib/rate-limit.ts` | The "not too many too fast" limiter. |
| `lib/listings.ts` | The rules: limits, validation, price and time formatting. |
| `lib/categories.ts` | The list of categories. |
| `lib/supabase.ts` | Connects to Supabase using the two keys. |
| `supabase/schema.sql` | The database setup. |

## Built with

- [Next.js](https://nextjs.org) (App Router) and [React 19](https://react.dev)
- [Supabase](https://supabase.com) (Postgres database and Storage)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com) v4
- [shadcn/ui](https://ui.shadcn.com) (Button, Input and Textarea) and [Lucide](https://lucide.dev) icons

I built this with the help of an AI coding assistant (Claude Code), which the challenge encourages.
