-- Nayagement: editable client profile fields and client-logo storage
-- Run this file once in the Supabase SQL Editor for an existing project.
-- It is safe to run again.

alter table public.clients
  add column if not exists description text,
  add column if not exists logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-logos',
  'client-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists client_logo_upload on storage.objects;
create policy client_logo_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-logos'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

do $publish_client_rows$
begin
  alter publication supabase_realtime add table public.clients;
exception when duplicate_object then null; end;
$publish_client_rows$;

notify pgrst, 'reload schema';
