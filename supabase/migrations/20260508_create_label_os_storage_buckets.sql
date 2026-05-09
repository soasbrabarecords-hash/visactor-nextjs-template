-- ============================================================
-- Label OS — Storage buckets e policies
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'label-covers',
    'label-covers',
    true,
    20971520,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'label-audio',
    'label-audio',
    false,
    262144000,
    array['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3']
  ),
  (
    'label-contracts',
    'label-contracts',
    false,
    26214400,
    array['application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "label os upload files" on storage.objects;
create policy "label os upload files"
on storage.objects
for insert
to authenticated
with check (bucket_id in ('label-covers', 'label-audio', 'label-contracts'));

drop policy if exists "label os update files" on storage.objects;
create policy "label os update files"
on storage.objects
for update
to authenticated
using (bucket_id in ('label-covers', 'label-audio', 'label-contracts'))
with check (bucket_id in ('label-covers', 'label-audio', 'label-contracts'));

drop policy if exists "label os read public covers" on storage.objects;
create policy "label os read public covers"
on storage.objects
for select
to public
using (bucket_id = 'label-covers');

drop policy if exists "label os read private files" on storage.objects;
create policy "label os read private files"
on storage.objects
for select
to authenticated
using (bucket_id in ('label-audio', 'label-contracts'));
