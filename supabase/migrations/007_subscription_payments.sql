create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('starter', 'professional', 'agency')),
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'USD',
  provider text not null default 'ecocash',
  customer_phone text not null,
  reference text not null unique,
  provider_transaction_id text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  failure_reason text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_payments enable row level security;

drop policy if exists subscription_payments_select_own on public.subscription_payments;
create policy subscription_payments_select_own
on public.subscription_payments for select
using (auth.uid() = user_id);

-- Inserts and status changes are performed by the server-side billing layer.
