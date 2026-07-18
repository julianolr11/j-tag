-- Execute uma vez no SQL Editor do Supabase.
-- Fotos de stories e perfis ficam no Storage; o banco guarda somente as URLs.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'story-media',
  'story-media',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "story media authenticated insert" on storage.objects;
drop policy if exists "story media authenticated update" on storage.objects;
drop policy if exists "story media authenticated delete" on storage.objects;

create policy "story media authenticated insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'story-media');

create policy "story media authenticated update"
on storage.objects for update
to authenticated
using (bucket_id = 'story-media')
with check (bucket_id = 'story-media');

create policy "story media authenticated delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'story-media');
