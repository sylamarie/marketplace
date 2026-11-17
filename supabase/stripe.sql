-- Database changes for Test 4 (Stripe Connect). Run it ONCE in the Supabase dashboard,
-- AFTER schema.sql:
--   SQL Editor  >  New query  >  paste everything below  >  Run
-- (Plain SQL only, on purpose: the SQL Editor's checker rejects some valid commands.
-- If it complains, run the statements one at a time.)

-- ---------------------------------------------------------------------------
-- 1. Listings get a "sold" flag. Only our server (the Stripe webhook) can turn it on.
-- ---------------------------------------------------------------------------
alter table public.listings add column sold boolean not null default false;

-- Visitors may still create listings, but not create one that is already "sold".
drop policy "Anyone can create listings" on public.listings;

create policy "Anyone can create listings"
  on public.listings for insert
  to anon, authenticated
  with check (sold = false);

-- ---------------------------------------------------------------------------
-- 2. Sellers: which Stripe account belongs to which email address.
--    (There are no logins: a seller is identified by the email on their listings.)
-- ---------------------------------------------------------------------------
create table public.sellers (
  email             text        primary key check (email = lower(email) and char_length(email) <= 254),
  stripe_account_id text        not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  -- true once Stripe says this account can take card payments
  charges_enabled   boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Orders: one row per paid Stripe Checkout, saved by the webhook.
--    Amounts are in cents (2500 = $25.00).
-- ---------------------------------------------------------------------------
create table public.orders (
  id                uuid        primary key default gen_random_uuid(),
  listing_id        uuid        not null references public.listings (id) on delete cascade,
  stripe_session_id text        not null unique,
  stripe_account_id text        not null,
  buyer_email       text,
  amount_total      integer     not null check (amount_total > 0),
  platform_fee      integer     not null check (platform_fee >= 0),
  currency          text        not null,
  status            text        not null default 'paid',
  created_at        timestamptz not null default now()
);

create index orders_listing_id_idx on public.orders (listing_id);

-- ---------------------------------------------------------------------------
-- 4. Locks. Both new tables are private: Row Level Security is on, there are no
--    rules for visitors, and visitors get no access at all. Only the website's
--    server (using the Supabase "secret" key) can read or write them. You can
--    still look at them in the Supabase Table Editor.
-- ---------------------------------------------------------------------------
alter table public.sellers enable row level security;
alter table public.orders enable row level security;

revoke all on public.sellers from anon, authenticated;
revoke all on public.orders from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. A tiny public list: ONLY the emails of sellers who can take payments. The
--    listing page uses it to decide whether to show the "Buy now" button. It
--    shows nothing but email addresses that are already public on their listings.
-- ---------------------------------------------------------------------------
create view public.onboarded_sellers as
  select email from public.sellers where charges_enabled;

grant select on public.onboarded_sellers to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Access for the website's SERVER. Supabase no longer gives its server role
--    ("service_role", the one the secret key uses) access to new tables by itself,
--    so we say exactly what it may do: read listings and mark them sold, and read
--    and write sellers and orders. (If you ran this file before step 6 existed,
--    just run these four lines on their own.)
-- ---------------------------------------------------------------------------
grant usage on schema public to service_role;
grant select, update on public.listings to service_role;
grant select, insert, update on public.sellers to service_role;
grant select, insert, update on public.orders to service_role;

-- ---------------------------------------------------------------------------
-- 7. A friendlier way to READ the orders table (optional). The real table keeps
--    money in cents, like Stripe does (2000 = $20.00). This view shows the same
--    orders in dollars, with the item's title. It is only for looking at in the
--    Supabase dashboard: visitors have no access to it (it contains buyer emails).
--    Run these two statements on their own if you ran this file before step 7 existed.
-- ---------------------------------------------------------------------------
create view public.orders_in_dollars with (security_invoker = true) as
  select
    o.created_at,
    l.title as item,
    (o.amount_total / 100.0)::numeric(12,2) as amount_paid,
    (o.platform_fee / 100.0)::numeric(12,2) as marketplace_fee,
    ((o.amount_total - o.platform_fee) / 100.0)::numeric(12,2) as seller_receives,
    upper(o.currency) as currency,
    o.buyer_email,
    o.status
  from public.orders o
  join public.listings l on l.id = o.listing_id
  order by o.created_at desc;

revoke all on public.orders_in_dollars from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Recent sales, for the bell in the top bar. PUBLIC on purpose, so it only
--    has what is already visible on a sold listing: the item, the price and the
--    time. It never has who bought it (no buyer email). Run these two statements
--    on their own if you ran this file before step 8 existed.
-- ---------------------------------------------------------------------------
create view public.recent_sales as
  select
    o.listing_id,
    l.title as item,
    (o.amount_total / 100.0)::numeric(12,2) as amount_paid,
    upper(o.currency) as currency,
    o.created_at as sold_at
  from public.orders o
  join public.listings l on l.id = o.listing_id
  order by o.created_at desc
  limit 20;

grant select on public.recent_sales to anon, authenticated;
