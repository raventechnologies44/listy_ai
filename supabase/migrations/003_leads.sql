create type public.lead_stage as enum (
  'new',
  'contacted',
  'interested',
  'viewing',
  'negotiation',
  'closed',
  'lost'
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  property_id uuid references public.properties (id) on delete set null,
  name text not null,
  phone text,
  email text,
  budget numeric(14, 2) check (budget is null or budget >= 0),
  requirements text,
  notes text,
  stage public.lead_stage not null default 'new',
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_agent_id_idx on public.leads (agent_id);
create index leads_property_id_idx on public.leads (property_id);
create index leads_stage_idx on public.leads (stage);
create index leads_next_follow_up_idx on public.leads (next_follow_up_at);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

create policy "Leads: select own"
  on public.leads for select
  using (auth.uid() = agent_id);

create policy "Leads: insert own"
  on public.leads for insert
  with check (auth.uid() = agent_id);

create policy "Leads: update own"
  on public.leads for update
  using (auth.uid() = agent_id)
  with check (auth.uid() = agent_id);

create policy "Leads: delete own"
  on public.leads for delete
  using (auth.uid() = agent_id);
