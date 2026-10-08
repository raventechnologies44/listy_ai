-- Run AFTER creating bucket "property-images" in Supabase Dashboard (public bucket).

create policy "Agents can upload own property images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Agents can update own property images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Agents can delete own property images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Public read property images"
on storage.objects for select
to public
using (bucket_id = 'property-images');
