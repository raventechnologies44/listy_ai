-- Subscription entitlements. Existing profiles are moved to Professional so
-- introducing the plan field does not unexpectedly remove functionality.
alter table public.profiles
  add column if not exists subscription_plan text not null default 'starter';

alter table public.profiles
  drop constraint if exists profiles_subscription_plan_check;

alter table public.profiles
  add constraint profiles_subscription_plan_check
  check (subscription_plan in ('starter', 'professional', 'agency'));

-- Preserve access for profiles that already existed before plan support.
update public.profiles
set subscription_plan = 'professional'
where subscription_plan = 'starter';

-- Users may edit their profile details, but plan changes must come from the
-- billing/admin layer. This trigger blocks client-side plan escalation.
create or replace function public.prevent_client_plan_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.subscription_plan is distinct from old.subscription_plan then
    raise exception 'Subscription plan can only be changed by the billing system.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_client_plan_change on public.profiles;
create trigger profiles_prevent_client_plan_change
  before update on public.profiles
  for each row execute function public.prevent_client_plan_change();

-- Enforce the active listing limit at the database boundary as well as in the UI.
create or replace function public.enforce_property_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan text;
  property_limit integer;
  active_count integer;
begin
  select subscription_plan into current_plan
  from public.profiles
  where id = new.agent_id;

  property_limit := case current_plan
    when 'starter' then 10
    when 'professional' then 50
    when 'agency' then null
    else 10
  end;

  if property_limit is not null then
    select count(*) into active_count
    from public.properties
    where agent_id = new.agent_id
      and status in ('available', 'viewing', 'negotiation')
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if active_count >= property_limit and new.status in ('available', 'viewing', 'negotiation') then
      raise exception 'Your % plan allows up to % active property listings.', initcap(current_plan), property_limit;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists properties_enforce_plan_limit on public.properties;
create trigger properties_enforce_plan_limit
  before insert or update of status, agent_id on public.properties
  for each row execute function public.enforce_property_plan_limit();

-- Marketing campaign scheduling is a Professional/Agency entitlement.
create or replace function public.enforce_schedule_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan text;
begin
  if new.schedule_type <> 'marketing_post' then
    return new;
  end if;

  select subscription_plan into current_plan
  from public.profiles
  where id = new.agent_id;

  if coalesce(current_plan, 'starter') = 'starter' then
    raise exception 'Scheduled marketing campaigns are available on Professional and Agency plans.';
  end if;

  return new;
end;
$$;

drop trigger if exists schedules_enforce_plan on public.agent_schedules;
create trigger schedules_enforce_plan
  before insert on public.agent_schedules
  for each row execute function public.enforce_schedule_plan_limit();
