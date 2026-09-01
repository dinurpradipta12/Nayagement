-- Nayagement: detail task, catatan kerja, dan lampiran privat.
-- Jalankan seluruh file ini sekali di Supabase SQL Editor sebelum memakai editor detail task.

begin;

alter table public.project_tasks
  add column if not exists progress_percentage smallint not null default 0,
  add column if not exists brief text;

update public.project_tasks
set progress_percentage = case when status = 'completed' then 100 else 0 end
where progress_percentage is null;

alter table public.project_tasks
  drop constraint if exists project_tasks_progress_percentage_range;

alter table public.project_tasks
  add constraint project_tasks_progress_percentage_range
  check (progress_percentage between 0 and 100);

create table if not exists public.project_task_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_task_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  storage_path text not null unique check (char_length(trim(storage_path)) between 1 and 500),
  mime_type text,
  file_size bigint not null default 0 check (file_size >= 0 and file_size <= 15728640),
  caption text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_task_notes_task_created_idx
  on public.project_task_notes (task_id, created_at desc);

create index if not exists project_task_attachments_task_created_idx
  on public.project_task_attachments (task_id, created_at desc);

alter table public.project_task_notes enable row level security;
alter table public.project_task_attachments enable row level security;

-- Tabel ini dibuat setelah skema utama, jadi hak akses browser perlu diberikan
-- secara eksplisit (grant global pada skema utama tidak berlaku surut).
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.project_task_notes, public.project_task_attachments to authenticated;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $is_workspace_member$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$is_workspace_member$;

revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

drop policy if exists workspace_member_manage on public.project_task_notes;
create policy workspace_member_manage on public.project_task_notes
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists workspace_member_manage on public.project_task_attachments;
create policy workspace_member_manage on public.project_task_attachments
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create or replace function public.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = public
as $safe_uuid$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$safe_uuid$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  15728640,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'application/zip', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists task_attachment_storage_read on storage.objects;
create policy task_attachment_storage_read on storage.objects
for select to authenticated
using (
  bucket_id = 'task-attachments'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists task_attachment_storage_insert on storage.objects;
create policy task_attachment_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'task-attachments'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists task_attachment_storage_delete on storage.objects;
create policy task_attachment_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'task-attachments'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

notify pgrst, 'reload schema';

commit;
