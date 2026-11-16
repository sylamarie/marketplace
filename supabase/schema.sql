-- Database setup for the Marketplace. Run it ONCE in the Supabase dashboard:
--   SQL Editor  >  New query  >  paste everything below  >  Run
-- (Plain SQL only, on purpose: the Supabase SQL Editor has a simple checker
-- that rejects some valid commands.) Run it once; a second run stops with an
-- "already exists" error, which is harmless.

-- ---------------------------------------------------------------------------
-- 1. Listings: one row per item for sale.
-- ---------------------------------------------------------------------------
create table public.listings (
  id           uuid          primary key default gen_random_uuid(),
  title        text          not null check (char_length(btrim(title)) between 1 and 100),
  description  text          not null default '' check (char_length(description) <= 2000),
  price        numeric(10,2) not null check (price >= 0 and price <= 1000000),
  category     text          not null check (category in (
                 'vehicles', 'property-rentals', 'apparel', 'classifieds', 'electronics',
                 'entertainment', 'family', 'free-stuff', 'garden-outdoor', 'hobbies',
                 'home-goods', 'home-improvement', 'home-sales', 'musical-instruments',
                 'office-supplies', 'pet-supplies', 'sporting-goods', 'toys-games',
                 'buy-sell-groups')),
  seller_email text          not null check (
                 char_length(seller_email) <= 254
                 and seller_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  -- The photo's file name in the "listing-images" bucket: a random id plus
  -- .jpg/.png/.gif/.webp. So a listing can only point at a photo in our own
  -- bucket, never at some other website.
  image_path   text          not null check (
                 image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|gif|webp)$'),
  location     text          not null default '' check (char_length(location) <= 100),
  created_at   timestamptz   not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Messages: what a buyer writes to a seller.
-- ---------------------------------------------------------------------------
create table public.messages (
  id          uuid        primary key default gen_random_uuid(),
  listing_id  uuid        not null references public.listings (id) on delete cascade,
  buyer_email text        not null check (
                char_length(buyer_email) <= 254
                and buyer_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  message     text        not null check (char_length(btrim(message)) between 1 and 1000),
  created_at  timestamptz not null default now()
);

-- Makes "newest listings first" and "messages for a listing" fast.
create index listings_created_at_idx on public.listings (created_at desc);
create index messages_listing_id_idx on public.messages (listing_id);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security: the database's own rules.
-- ---------------------------------------------------------------------------
alter table public.listings enable row level security;
alter table public.messages enable row level security;

-- The website talks to the database as the "anon" role. Give it only what it
-- needs: read and add listings, and ADD messages (but never read them back).
grant usage on schema public to anon, authenticated;
grant select, insert on public.listings to anon, authenticated;
grant insert on public.messages to anon, authenticated;

create policy "Anyone can view listings"
  on public.listings for select
  to anon, authenticated
  using (true);

create policy "Anyone can create listings"
  on public.listings for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can send a message"
  on public.messages for insert
  to anon, authenticated
  with check (true);

-- There is deliberately NO rule to read messages (they contain buyers' email
-- addresses, so visitors must not be able to list them), and NO rule to edit or
-- delete anything. You can read the messages in the Supabase Table Editor.

-- ---------------------------------------------------------------------------
-- 4. Photos: a public Storage bucket called listing-images. Images only (no
--    SVG, which can carry scripts) and at most 5 MB each. Anyone may upload,
--    but only under a random-id name; nobody can list, replace or delete.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

create policy "Anyone can upload listing images"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'listing-images'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|gif|webp)$'
  );
