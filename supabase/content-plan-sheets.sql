-- Nayagement: Content Plan & Spreadsheets Hub
-- Jalankan seluruh file ini langsung di Supabase SQL Editor.
-- Aman dijalankan ulang dan tidak membuat data contoh.

do $content_plan_prerequisites$
begin
  if to_regclass('public.workspaces') is null
    or to_regclass('public.workspace_members') is null
    or to_regclass('public.clients') is null then
    raise exception 'Schema utama Nayagement belum lengkap. Jalankan schema.sql terlebih dahulu.';
  end if;
  if to_regprocedure('public.is_workspace_member(uuid)') is null
    or to_regprocedure('public.is_workspace_admin(uuid)') is null then
    raise exception 'Helper akses workspace belum tersedia. Jalankan schema.sql terlebih dahulu.';
  end if;
end;
$content_plan_prerequisites$;

create table if not exists public.content_plan_sheets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  title text not null,
  sheet_url text not null,
  embed_url text,
  platform text not null default 'Instagram & TikTok',
  status text not null default 'active',
  logo_url text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_plan_sheets_client_name_length check (char_length(btrim(client_name)) between 2 and 120),
  constraint content_plan_sheets_title_length check (char_length(btrim(title)) between 2 and 180),
  constraint content_plan_sheets_sheet_url_length check (char_length(btrim(sheet_url)) between 20 and 2048),
  constraint content_plan_sheets_platform_check check (platform in ('Instagram & TikTok', 'Instagram Reels', 'LinkedIn & Article', 'All Social Channels')),
  constraint content_plan_sheets_status_check check (status in ('active', 'archived'))
);

create index if not exists content_plan_sheets_workspace_id_idx
  on public.content_plan_sheets(workspace_id);

create index if not exists content_plan_sheets_workspace_updated_at_idx
  on public.content_plan_sheets(workspace_id, updated_at desc);

create unique index if not exists content_plan_sheets_workspace_url_unique
  on public.content_plan_sheets(workspace_id, lower(btrim(sheet_url)))
  where status = 'active';

create or replace function public.content_plan_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $content_plan_set_updated_at$
begin
  new.updated_at = now();
  return new;
end;
$content_plan_set_updated_at$;

drop trigger if exists content_plan_sheets_updated_at on public.content_plan_sheets;
create trigger content_plan_sheets_updated_at
before update on public.content_plan_sheets
for each row execute function public.content_plan_set_updated_at();

create or replace function public.content_plan_validate_client_workspace()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $content_plan_validate_client_workspace$
begin
  if new.client_id is not null and not exists (
    select 1
    from public.clients client
    where client.id = new.client_id
      and client.workspace_id = new.workspace_id
  ) then
    raise exception 'Klien tidak berada dalam workspace yang sama';
  end if;
  return new;
end;
$content_plan_validate_client_workspace$;

drop trigger if exists content_plan_sheets_validate_client on public.content_plan_sheets;
create trigger content_plan_sheets_validate_client
before insert or update of workspace_id, client_id on public.content_plan_sheets
for each row execute function public.content_plan_validate_client_workspace();

alter table public.content_plan_sheets enable row level security;

drop policy if exists content_plan_sheets_member_read on public.content_plan_sheets;
create policy content_plan_sheets_member_read
on public.content_plan_sheets
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists content_plan_sheets_admin_insert on public.content_plan_sheets;
create policy content_plan_sheets_admin_insert
on public.content_plan_sheets
for insert to authenticated
with check (
  public.is_workspace_admin(workspace_id)
  and created_by = auth.uid()
);

drop policy if exists content_plan_sheets_admin_update on public.content_plan_sheets;
create policy content_plan_sheets_admin_update
on public.content_plan_sheets
for update to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists content_plan_sheets_admin_delete on public.content_plan_sheets;
create policy content_plan_sheets_admin_delete
on public.content_plan_sheets
for delete to authenticated
using (public.is_workspace_admin(workspace_id));

grant select, insert, update, delete on public.content_plan_sheets to authenticated;

create or replace function public.content_plan_safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $content_plan_safe_uuid$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$content_plan_safe_uuid$;

revoke all on function public.content_plan_safe_uuid(text) from public;
grant execute on function public.content_plan_safe_uuid(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-plan-assets',
  'content-plan-assets',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists content_plan_assets_member_read on storage.objects;
create policy content_plan_assets_member_read
on storage.objects
for select to authenticated
using (
  bucket_id = 'content-plan-assets'
  and public.is_workspace_member(public.content_plan_safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists content_plan_assets_admin_insert on storage.objects;
create policy content_plan_assets_admin_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'content-plan-assets'
  and public.is_workspace_admin(public.content_plan_safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists content_plan_assets_admin_update on storage.objects;
create policy content_plan_assets_admin_update
on storage.objects
for update to authenticated
using (
  bucket_id = 'content-plan-assets'
  and public.is_workspace_admin(public.content_plan_safe_uuid((storage.foldername(name))[1]))
)
with check (
  bucket_id = 'content-plan-assets'
  and public.is_workspace_admin(public.content_plan_safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists content_plan_assets_admin_delete on storage.objects;
create policy content_plan_assets_admin_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'content-plan-assets'
  and public.is_workspace_admin(public.content_plan_safe_uuid((storage.foldername(name))[1]))
);

alter table public.content_plan_sheets replica identity full;

do $content_plan_realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'content_plan_sheets'
  ) then
    alter publication supabase_realtime add table public.content_plan_sheets;
  end if;
end;
$content_plan_realtime$;

notify pgrst, 'reload schema';

select 'content_plan_sheets_ready' as status;
