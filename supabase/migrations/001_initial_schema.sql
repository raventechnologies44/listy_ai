-- ListyAI Day 1 schema: profiles, properties, property_images + RLS

-- Enums
create type public.property_type as enum (
  'house',
  'apartment',
  'condo',
  'townhouse',
  'land',
  'commercial',
  'other'
);

create type public.listing_type as enum ('sale', 'rent');

create type public.property_status as enum (
  'available',
  'viewing',
  'negotiation',
  'sold',
  'rented'
);

-- Agent profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  brokerage text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Properties
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  property_type public.property_type not null default 'house',
  listing_type public.listing_type not null default 'sale',
  price numeric(14, 2) not null check (price >= 0),
  location text not null,
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms numeric(4, 1) check (bathrooms is null or bathrooms >= 0),
  size numeric(12, 2) check (size is null or size >= 0),
  features text[] not null default '{}',
  status public.property_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index properties_agent_id_idx on public.properties (agent_id);
create index properties_status_idx on public.properties (status);
create index properties_created_at_idx on public.properties (created_at desc);

-- Property images
create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index property_images_property_id_idx on public.property_images (property_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;

-- Profiles: own row only
create policy "Profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Properties: full CRUD for owner
create policy "Properties: select own"
  on public.properties for select
  using (auth.uid() = agent_id);

create policy "Properties: insert own"
  on public.properties for insert
  with check (auth.uid() = agent_id);

create policy "Properties: update own"
  on public.properties for update
  using (auth.uid() = agent_id)
  with check (auth.uid() = agent_id);

create policy "Properties: delete own"
  on public.properties for delete
  using (auth.uid() = agent_id);

-- Property images: via property ownership
create policy "Property images: select own"
  on public.property_images for select
  using (auth.uid() = agent_id);

create policy "Property images: insert own"
  on public.property_images for insert
  with check (
    auth.uid() = agent_id
    and exists (
      select 1 from public.properties p
      where p.id = property_id and p.agent_id = auth.uid()
    )
  );

create policy "Property images: update own"
  on public.property_images for update
  using (auth.uid() = agent_id)
  with check (auth.uid() = agent_id);

create policy "Property images: delete own"
  on public.property_images for delete
  using (auth.uid() = agent_id);

-- Storage bucket policies (run after creating bucket "property-images" in Dashboard)
-- See supabase/STORAGE_SETUP.md
