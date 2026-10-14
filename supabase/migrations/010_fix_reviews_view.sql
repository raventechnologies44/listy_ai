-- Replaces the SECURITY DEFINER view with a security_invoker view plus column-level grants.
-- Public can read ONLY the safe review columns; phone_key and ip_hash stay unreadable.
-- Safe to run more than once.

drop view if exists public.agent_reviews_public;

drop policy if exists "Market: public read reviews" on public.agent_reviews;
create policy "Market: public read reviews"
  on public.agent_reviews for select
  to anon, authenticated
  using (true);

revoke all on public.agent_reviews from anon, authenticated;
grant select (id, agent_id, reviewer_name, rating, comment, created_at)
  on public.agent_reviews to anon, authenticated;

create view public.agent_reviews_public
  with (security_invoker = true) as
  select id, agent_id, reviewer_name, rating, comment, created_at
  from public.agent_reviews;

grant select on public.agent_reviews_public to anon, authenticated;
