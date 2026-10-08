# Supabase Storage: property images

After running the SQL migration, configure storage in the Supabase Dashboard:

1. **Storage → New bucket**
   - Name: `property-images`
   - Public bucket: **Yes** (so listing pages can show image URLs via `getPublicUrl`)
   - File size limit: e.g. 5 MB (optional)
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif` (optional)

2. **Storage policies** (SQL Editor) — agents upload only under their user id:

```sql
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
```

Upload path used by the app: `{userId}/{propertyId}/{filename}`.
