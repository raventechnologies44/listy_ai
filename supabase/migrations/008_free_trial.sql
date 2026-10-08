-- ListyAI: five-day free trial for every new account.
-- New users select Starter, Professional or Agency at sign-up.
-- Existing accounts remain active and unchanged.

alter table public.profiles
  add column if not exists subscription_status text not null default 'active';

alter table public.profiles
  add column if not exists trial_started_at timestamptz;

alter table public.profiles
  add column if not exists trial_ends_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('trial', 'active', 'expired', 'pending'));

-- Existing users keep their current access.
update public.profiles
set subscription_status = 'active'
where subscription_status is null
   or (subscription_status = 'trial' and trial_started_at is null);

-- Signup creates the profile with the selected plan and starts the trial.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_plan text;
begin
  selected_plan := case
    when new.raw_user_meta_data ->> 'trial_plan' in ('starter', 'professional', 'agency')
      then new.raw_user_meta_data ->> 'trial_plan'
    else 'starter'
  end;

  insert into public.profiles (
    id, full_name, email, subscription_plan, subscription_status, trial_started_at, trial_ends_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    selected_plan,
    'trial',
    now(),
    now() + interval '5 days'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep the trial state authoritative in the database. This is a maintenance
-- helper for server/admin jobs; it does not remove user data.
create or replace function public.expire_listyai_trials()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set subscription_status = 'expired'
  where subscription_status = 'trial'
    and trial_ends_at is not null
    and trial_ends_at <= now();
$$;
