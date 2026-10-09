create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  waba_id text not null,
  phone_number_id text not null,
  display_phone_number text,
  business_name text,
  status text not null default 'connected' check (status in ('connected','disconnected','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, phone_number_id),
  unique (phone_number_id)
);

create index whatsapp_connections_agent_id_idx on public.whatsapp_connections(agent_id);
create index whatsapp_connections_phone_number_id_idx on public.whatsapp_connections(phone_number_id);

alter table public.whatsapp_connections enable row level security;
create policy "WhatsApp connections: select own" on public.whatsapp_connections for select using (auth.uid() = agent_id);
create policy "WhatsApp connections: insert own" on public.whatsapp_connections for insert with check (auth.uid() = agent_id);
create policy "WhatsApp connections: update own" on public.whatsapp_connections for update using (auth.uid() = agent_id) with check (auth.uid() = agent_id);
create policy "WhatsApp connections: delete own" on public.whatsapp_connections for delete using (auth.uid() = agent_id);

-- Access tokens are intentionally kept in a server-only table. There are no client RLS policies.
create table public.whatsapp_connection_secrets (
  connection_id uuid primary key references public.whatsapp_connections(id) on delete cascade,
  access_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_connection_secrets enable row level security;

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  whatsapp_message_id text unique,
  phone_number text not null,
  contact_name text,
  body text,
  status text not null default 'received',
  extracted jsonb,
  lead_id uuid references public.leads(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  suggested_reply text,
  error_message text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index whatsapp_messages_agent_id_idx on public.whatsapp_messages(agent_id);
create index whatsapp_messages_connection_id_idx on public.whatsapp_messages(connection_id);
create index whatsapp_messages_created_at_idx on public.whatsapp_messages(created_at desc);

alter table public.whatsapp_messages enable row level security;
create policy "WhatsApp messages: select own" on public.whatsapp_messages for select using (auth.uid() = agent_id);
create policy "WhatsApp messages: insert own" on public.whatsapp_messages for insert with check (auth.uid() = agent_id);
create policy "WhatsApp messages: update own" on public.whatsapp_messages for update using (auth.uid() = agent_id) with check (auth.uid() = agent_id);
