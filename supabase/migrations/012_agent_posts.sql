-- Agent posts: a caption + chosen photos published to ListyMarket's "Agent posts" feed.
-- Additive. Safe to run more than once. Run AFTER 009, 010 and 011.

alter table public.published_listings add column if not exists post_caption text;
alter table public.published_listings add column if not exists post_image_paths text[] not null default '{}';

-- Same sync function as before, now also dropping post photos that were deleted from the property.
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
      post_image_paths = coalesce((
        select array_agg(t.x order by t.n)
        from unnest(l.post_image_paths) with ordinality as t(x, n)
        where t.x in (select i.storage_path from public.property_images i where i.property_id = p.id)
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

-- Agent action: publish (or renew) the listing AND its post (caption + photos).
create or replace function public.publish_listing_post(
  p_property_id uuid,
  p_caption text,
  p_image_paths text[]
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires timestamptz;
begin
  v_expires := public.publish_listing(p_property_id);

  update public.published_listings l
  set post_caption = nullif(left(btrim(coalesce(p_caption, '')), 2200), ''),
      post_image_paths = coalesce((
        select array_agg(t.x order by t.n)
        from unnest(coalesce(p_image_paths, '{}'::text[])) with ordinality as t(x, n)
        where t.x in (select i.storage_path from public.property_images i where i.property_id = p_property_id)
      ), '{}')
  where l.property_id = p_property_id
    and l.agent_id = auth.uid();

  return v_expires;
end;
$$;

revoke all on function public.publish_listing_post(uuid, text, text[]) from public, anon;
grant execute on function public.publish_listing_post(uuid, text, text[]) to authenticated;
