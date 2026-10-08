create type public.schedule_type as enum (
  'property_viewing',
  'follow_up_task',
  'marketing_post'
);

create table public.agent_schedules (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  schedule_type public.schedule_type not null,
  title text not null,
  notes text,
  scheduled_at timestamptz not null,
  property_id uuid references public.properties (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agent_schedules_agent_id_idx on public.agent_schedules (agent_id);
create index agent_schedules_scheduled_at_idx on public.agent_schedules (scheduled_at);
create index agent_schedules_type_idx on public.agent_schedules (schedule_type);

create trigger agent_schedules_set_updated_at
  before update on public.agent_schedules
  for each row execute function public.set_updated_at();

alter table public.agent_schedules enable row level security;

create policy "Schedules: select own"
  on public.agent_schedules for select
  using (auth.uid() = agent_id);

create policy "Schedules: insert own"
  on public.agent_schedules for insert
  with check (auth.uid() = agent_id);

create policy "Schedules: update own"
  on public.agent_schedules for update
  using (auth.uid() = agent_id)
  with check (auth.uid() = agent_id);

create policy "Schedules: delete own"
  on public.agent_schedules for delete
  using (auth.uid() = agent_id);

-- Integration-ready log (webhook can insert later; manual paste uses app)
create table public.whatsapp_enquiries (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  raw_message text not null,
  extracted_name text,
  extracted_phone text,
  extracted_email text,
  extracted_budget numeric(14, 2),
  extracted_requirements text,
  lead_id uuid references public.leads (id) on delete set null,
  property_id uuid references public.properties (id) on delete set null,
  suggested_reply text,
  created_at timestamptz not null default now()
);

create index whatsapp_enquiries_agent_id_idx on public.whatsapp_enquiries (agent_id);

alter table public.whatsapp_enquiries enable row level security;

create policy "WhatsApp enquiries: select own"
  on public.whatsapp_enquiries for select
  using (auth.uid() = agent_id);

create policy "WhatsApp enquiries: insert own"
  on public.whatsapp_enquiries for insert
  with check (auth.uid() = agent_id);

create policy "WhatsApp enquiries: update own"
  on public.whatsapp_enquiries for update
  using (auth.uid() = agent_id)
  with check (auth.uid() = agent_id);

create policy "WhatsApp enquiries: delete own"
  on public.whatsapp_enquiries for delete
  using (auth.uid() = agent_id);
