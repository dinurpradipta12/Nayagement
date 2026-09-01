-- Nayagement Settings enhancement
-- Jalankan seluruh file ini sekali di Supabase SQL Editor, lalu muat ulang aplikasi.

create or replace function public.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

alter table public.user_profiles
  add column if not exists full_name text,
  add column if not exists username text,
  add column if not exists phone text,
  add column if not exists bio text,
  add column if not exists role_title text,
  add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table public.workspaces
  add column if not exists description text,
  add column if not exists logo_path text;

-- Salin username login lama sebagai nilai awal profil bila tersedia.
update public.user_profiles profile
set username = identity.username
from public.admin_login_identities identity
where identity.user_id = profile.id
  and (profile.username is null or btrim(profile.username) = '');

create unique index if not exists user_profiles_username_lower_key
  on public.user_profiles (lower(username))
  where username is not null and btrim(username) <> '';

alter table public.user_profiles
  drop constraint if exists user_profiles_username_format;

alter table public.user_profiles
  add constraint user_profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');

-- Pastikan pemilik profil dapat membuat profilnya sendiri bila trigger registrasi belum membuatnya.
drop policy if exists own_profile_insert on public.user_profiles;
create policy own_profile_insert
on public.user_profiles
for insert to authenticated
with check (id = auth.uid());

-- Bucket untuk avatar pribadi dan logo workspace.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nayagement-settings',
  'nayagement-settings',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists nayagement_settings_read on storage.objects;
create policy nayagement_settings_read
on storage.objects
for select to authenticated
using (bucket_id = 'nayagement-settings');

drop policy if exists nayagement_settings_insert on storage.objects;
create policy nayagement_settings_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'nayagement-settings'
  and (
    (
      (storage.foldername(name))[1] = 'profiles'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'workspaces'
      and public.is_workspace_admin(public.safe_uuid((storage.foldername(name))[2]))
    )
  )
);

drop policy if exists nayagement_settings_update on storage.objects;
create policy nayagement_settings_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'nayagement-settings'
  and (
    ((storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'workspaces' and public.is_workspace_admin(public.safe_uuid((storage.foldername(name))[2])))
  )
)
with check (
  bucket_id = 'nayagement-settings'
  and (
    ((storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'workspaces' and public.is_workspace_admin(public.safe_uuid((storage.foldername(name))[2])))
  )
);

drop policy if exists nayagement_settings_delete on storage.objects;
create policy nayagement_settings_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'nayagement-settings'
  and (
    ((storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'workspaces' and public.is_workspace_admin(public.safe_uuid((storage.foldername(name))[2])))
  )
);
