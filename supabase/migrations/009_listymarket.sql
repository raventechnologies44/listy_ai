-- ListyMarket: public listings, buyer requests, enquiries, reports, agent reviews.
-- Additive only. Does not alter existing tables. Run once in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. Public listings (a safe copy of selected property fields)
-- ---------------------------------------------------------------------------
create table if not exists public.published_listings (
  property_id uuid primary key references public.properties (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  property_type public.property_type not null,
  listing_type public.listing_type not null,
  price numeric(14, 2) not null,
  location text not null,
  bedrooms integer,
  bathrooms numeric(4, 1),
  size numeric(12, 2),
  features text[] not null default '{}',
  status public.property_status not null,
  image_paths text[] not null default '{}',
  agent_name text,
  agent_phone text,
  agent_brokerage text,
  flagged boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists published_listings_agent_idx on public.published_listings (agent_id);
create index if not exists published_listings_published_idx on public.published_listings (published_at desc);

alter table public.published_listings enable row level security;

-- Public can see only live, unflagged, unexpired, still-active listings.
create policy "Market: public read live listings"
  on public.published_listings for select
  to anon, authenticated
  using (
    flagged = false
    and expires_at > now()
    and status in ('available', 'viewing', 'negotiation')
  );

-- Agents can always see their own rows (including expired / flagged).
create policy "Market: agent read own listings"
  on public.published_listings for select
  to authenticated
  using (auth.uid() = agent_id);

-- No insert/update/delete policies: clients write only through the functions below.

-- Internal: refresh an existing published row from the live property data.
create or replace function public.refresh_published_listing(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.published_listings l
  set title = p.title,
      description = p.description,
      property_type = p.property_type,
      listing_type = p.listing_type,
      price = p.price,
      location = p.location,
      bedrooms = p.bedrooms,
      bathrooms = p.bathrooms,
      size = p.size,
      features = p.features,
      status = p.status,
      image_paths = coalesce((
        select array_agg(i.storage_path order by i.sort_order, i.created_at)
        from public.property_images i
        where i.property_id = p.id
      ), '{}'),
      agent_name = pr.full_name,
      agent_phone = pr.phone,
      agent_brokerage = pr.brokerage,
      updated_at = now()
  from public.properties p
  join public.profiles pr on pr.id = p.agent_id
  where p.id = p_property_id
    and l.property_id = p.id;
end;
$$;

revoke all on function public.refresh_published_listing(uuid) from public, anon, authenticated;

-- Agent action: publish (or renew) one of their own properties for 30 days.
create or replace function public.publish_listing(p_property_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_expires timestamptz := now() + interval '30 days';
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from public.properties where id = p_property_id and agent_id = v_uid) then
    raise exception 'Property not found';
  end if;

  insert into public.published_listings (
    property_id, agent_id, title, description, property_type, listing_type, price, location,
    bedrooms, bathrooms, size, features, status, image_paths,
    agent_name, agent_phone, agent_brokerage, published_at, expires_at
  )
  select
    p.id, p.agent_id, p.title, p.description, p.property_type, p.listing_type, p.price, p.location,
    p.bedrooms, p.bathrooms, p.size, p.features, p.status,
    coalesce((select array_agg(i.storage_path order by i.sort_order, i.created_at)
              from public.property_images i where i.property_id = p.id), '{}'),
    pr.full_name, pr.phone, pr.brokerage, now(), v_expires
  from public.properties p
  join public.profiles pr on pr.id = p.agent_id
  where p.id = p_property_id
  on conflict (property_id) do update
    set expires_at = v_expires,
        published_at = now(),
        updated_at = now();

  perform public.refresh_published_listing(p_property_id);
  return v_expires;
end;
$$;

revoke all on function public.publish_listing(uuid) from public, anon;
grant execute on function public.publish_listing(uuid) to authenticated;

-- Agent action: take a listing off ListyMarket.
create or replace function public.unpublish_listing(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.published_listings
  where property_id = p_property_id and agent_id = auth.uid();
end;
$$;

revoke all on function public.unpublish_listing(uuid) from public, anon;
grant execute on function public.unpublish_listing(uuid) to authenticated;

-- Keep public copies in sync when the agent edits the property, photos or profile.
create or replace function public.trg_refresh_listing_from_property()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_published_listing(new.id);
  return new;
end;
$$;

drop trigger if exists properties_refresh_listing on public.properties;
create trigger properties_refresh_listing
  after update on public.properties
  for each row execute function public.trg_refresh_listing_from_property();

create or replace function public.trg_refresh_listing_from_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_published_listing(old.property_id);
    return old;
  end if;
  perform public.refresh_published_listing(new.property_id);
  return new;
end;
$$;

drop trigger if exists property_images_refresh_listing on public.property_images;
create trigger property_images_refresh_listing
  after insert or update or delete on public.property_images
  for each row execute function public.trg_refresh_listing_from_image();

create or replace function public.trg_refresh_listings_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in select property_id from public.published_listings where agent_id = new.id loop
    perform public.refresh_published_listing(r.property_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists profiles_refresh_listings on public.profiles;
create trigger profiles_refresh_listings
  after update of full_name, phone, brokerage on public.profiles
  for each row execute function public.trg_refresh_listings_from_profile();

-- ---------------------------------------------------------------------------
-- 2. Buyer requests (written only by the server using the service role)
-- ---------------------------------------------------------------------------
create table if not exists public.buyer_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  phone_key text not null,
  raw_text text not null,
  parsed jsonb not null default '{}'::jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists buyer_requests_phone_idx on public.buyer_requests (phone_key, created_at desc);
create index if not exists buyer_requests_ip_idx on public.buyer_requests (ip_hash, created_at desc);

create table if not exists public.buyer_request_recipients (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.buyer_requests (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  match_score integer not null default 0,
  matched_property_ids uuid[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'converted', 'dismissed')),
  lead_id uuid references public.leads (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (request_id, agent_id)
);

create index if not exists buyer_request_recipients_agent_idx
  on public.buyer_request_recipients (agent_id, created_at desc);

alter table public.buyer_requests enable row level security;
alter table public.buyer_request_recipients enable row level security;

create policy "Market: agent reads routed requests"
  on public.buyer_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.buyer_request_recipients r
      where r.request_id = buyer_requests.id and r.agent_id = auth.uid()
    )
  );

create policy "Market: agent reads own recipient rows"
  on public.buyer_request_recipients for select
  to authenticated
  using (auth.uid() = agent_id);

create policy "Market: agent updates own recipient rows"
  on public.buyer_request_recipients for update
  to authenticated
  using (auth.uid() = agent_id)
  with check (auth.uid() = agent_id);

-- ---------------------------------------------------------------------------
-- 3. Listing enquiries (customer -> agent, from a listing page)
-- ---------------------------------------------------------------------------
create table if not exists public.market_enquiries (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  name text not null,
  phone text not null,
  phone_key text not null,
  message text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists market_enquiries_agent_phone_idx on public.market_enquiries (agent_id, phone_key);
create index if not exists market_enquiries_ip_idx on public.market_enquiries (ip_hash, created_at desc);

alter table public.market_enquiries enable row level security;

create policy "Market: agent reads own enquiries"
  on public.market_enquiries for select
  to authenticated
  using (auth.uid() = agent_id);

-- ---------------------------------------------------------------------------
-- 4. Listing reports (server-written). 3 distinct reporters hide a listing.
-- ---------------------------------------------------------------------------
create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  reason text not null,
  details text,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  unique (property_id, ip_hash)
);

alter table public.listing_reports enable row level security;
-- no policies: only the service role can read/write.

-- To restore a wrongly flagged listing (after review), run:
--   update public.published_listings set flagged = false where property_id = '<id>';
--   delete from public.listing_reports where property_id = '<id>';

-- ---------------------------------------------------------------------------
-- 5. Agent reviews (written by the server; only verified enquirers can review)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_reviews (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_name text not null,
  phone_key text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  ip_hash text,
  created_at timestamptz not null default now(),
  unique (agent_id, phone_key)
);

create index if not exists agent_reviews_agent_idx on public.agent_reviews (agent_id, created_at desc);

alter table public.agent_reviews enable row level security;
-- Public reads happen via 010_fix_reviews_view.sql (column-level grants + security_invoker view).
