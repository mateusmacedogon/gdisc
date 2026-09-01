-- Store optimized server icons as files instead of embedding long image URLs in rows.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'server-icons',
  'server-icons',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Server icons can be selected by managers" on storage.objects;
create policy "Server icons can be selected by managers"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'server-icons'
  and private.has_server_permission(((storage.foldername(name))[1])::uuid, 2::bigint)
);

drop policy if exists "Server icons can be inserted by managers" on storage.objects;
create policy "Server icons can be inserted by managers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'server-icons'
  and private.has_server_permission(((storage.foldername(name))[1])::uuid, 2::bigint)
);

drop policy if exists "Server icons can be updated by managers" on storage.objects;
create policy "Server icons can be updated by managers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'server-icons'
  and private.has_server_permission(((storage.foldername(name))[1])::uuid, 2::bigint)
)
with check (
  bucket_id = 'server-icons'
  and private.has_server_permission(((storage.foldername(name))[1])::uuid, 2::bigint)
);

drop policy if exists "Server icons can be deleted by managers" on storage.objects;
create policy "Server icons can be deleted by managers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'server-icons'
  and private.has_server_permission(((storage.foldername(name))[1])::uuid, 2::bigint)
);

alter table public.servers drop constraint if exists servers_icon_url_length_check;
alter table public.servers
  add constraint servers_icon_url_length_check
  check (icon_url is null or char_length(icon_url) <= 8192);
