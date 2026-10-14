-- Publish history: which channels an agent has published or shared a property to.
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  channel text not null check (channel in ('listymarket', 'facebook', 'instagram', 'tiktok')),
  status text not null check (status in ('published', 'shared')),
  caption text,
  image_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists social_posts_agent_idx on public.social_posts (agent_id, created_at desc);
create index if not exists social_posts_property_idx on public.social_posts (property_id, created_at desc);

alter table public.social_posts enable row level security;

create policy "Social posts: agent reads own"
  on public.social_posts for select to authenticated
  using (auth.uid() = agent_id);

create policy "Social posts: agent inserts own"
  on public.social_posts for insert to authenticated
  with check (
    auth.uid() = agent_id
    and exists (select 1 from public.properties p where p.id = property_id and p.agent_id = auth.uid())
  );

create policy "Social posts: agent deletes own"
  on public.social_posts for delete to authenticated
  using (auth.uid() = agent_id);
