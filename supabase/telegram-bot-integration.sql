-- Nayagement Telegram Bot integration
-- Jalankan seluruh file ini sekali di Supabase SQL Editor.
-- Aman dijalankan ulang dan tidak menghapus data bisnis yang sudah ada.

create table if not exists public.telegram_integrations (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  pairing_code text not null unique default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  chat_id bigint unique,
  chat_username text,
  bot_username text,
  app_base_url text,
  is_enabled boolean not null default true,
  notify_orders boolean not null default true,
  notify_bookings boolean not null default true,
  notify_tasks boolean not null default true,
  notify_projects boolean not null default true,
  notify_invoices boolean not null default true,
  reminder_enabled boolean not null default true,
  reminder_morning time not null default '08:00',
  reminder_noon time not null default '13:00',
  reminder_evening time not null default '19:00',
  timezone text not null default 'Asia/Makassar',
  connected_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.telegram_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  notification_id uuid unique references public.notifications(id) on delete cascade,
  event_type text not null check (event_type in ('order', 'booking', 'task', 'project', 'invoice', 'finance', 'client', 'deadline', 'system')),
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'skipped', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default timezone('utc', now()),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.telegram_reminder_runs (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reminder_date date not null,
  reminder_slot text not null check (reminder_slot in ('morning', 'noon', 'evening')),
  sent_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, reminder_date, reminder_slot)
);

create index if not exists telegram_outbox_pending_idx
  on public.telegram_outbox (status, next_attempt_at, created_at);

drop trigger if exists telegram_integrations_set_updated_at on public.telegram_integrations;
create trigger telegram_integrations_set_updated_at before update on public.telegram_integrations
for each row execute function public.set_updated_at();

drop trigger if exists telegram_outbox_set_updated_at on public.telegram_outbox;
create trigger telegram_outbox_set_updated_at before update on public.telegram_outbox
for each row execute function public.set_updated_at();

alter table public.telegram_integrations enable row level security;
alter table public.telegram_outbox enable row level security;
alter table public.telegram_reminder_runs enable row level security;

drop policy if exists telegram_integrations_admin_manage on public.telegram_integrations;
create policy telegram_integrations_admin_manage on public.telegram_integrations
for all to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

revoke all on public.telegram_integrations, public.telegram_outbox, public.telegram_reminder_runs from anon;
revoke all on public.telegram_outbox, public.telegram_reminder_runs from authenticated;
grant select, insert, update, delete on public.telegram_integrations to authenticated;
grant all on public.telegram_integrations, public.telegram_outbox, public.telegram_reminder_runs to service_role;

create or replace function public.regenerate_telegram_pairing_code(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $regenerate_telegram_pairing_code$
declare
  v_code text := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
begin
  if not public.is_workspace_admin(p_workspace_id) then
    raise exception 'Hanya admin workspace yang dapat mengatur Telegram';
  end if;

  insert into public.telegram_integrations (workspace_id, pairing_code)
  values (p_workspace_id, v_code)
  on conflict (workspace_id) do update set
    pairing_code = excluded.pairing_code,
    chat_id = null,
    chat_username = null,
    connected_at = null;
  return v_code;
end;
$regenerate_telegram_pairing_code$;

revoke all on function public.regenerate_telegram_pairing_code(uuid) from public;
grant execute on function public.regenerate_telegram_pairing_code(uuid) to authenticated;

create or replace function public.queue_telegram_test(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $queue_telegram_test$
begin
  if not public.is_workspace_admin(p_workspace_id) then
    raise exception 'Hanya admin workspace yang dapat mengirim tes Telegram';
  end if;
  insert into public.notifications (workspace_id, kind, title, body, entity_type)
  values (p_workspace_id, 'system', 'Tes Telegram Nayagement', 'Koneksi bot aktif dan siap menerima pembaruan workspace.', 'system');
end;
$queue_telegram_test$;

revoke all on function public.queue_telegram_test(uuid) from public;
grant execute on function public.queue_telegram_test(uuid) to authenticated;

create or replace function public.enqueue_notification_for_telegram()
returns trigger
language plpgsql
security definer
set search_path = public
as $enqueue_notification_for_telegram$
declare
  v_event_type text := new.kind::text;
  v_entity_type text := new.entity_type;
  v_entity_id uuid := new.entity_id;
begin
  -- Versi awal fungsi booking membuat notification tanpa entity. Hubungkan
  -- notification itu ke booking yang baru saja dibuat dalam transaksi sama.
  if v_entity_type is null and lower(new.title) like '%booking konsultasi%' then
    select booking.id into v_entity_id
    from public.consultation_bookings booking
    where booking.workspace_id = new.workspace_id
    order by booking.created_at desc
    limit 1;
    v_entity_type := 'consultation_booking';
    v_event_type := 'booking';
  elsif v_entity_type = 'order_submission' then
    v_event_type := 'order';
  elsif v_entity_type = 'consultation_booking' then
    v_event_type := 'booking';
  elsif v_entity_type = 'project_task' then
    v_event_type := 'task';
  elsif v_entity_type = 'project' then
    v_event_type := 'project';
  elsif v_entity_type = 'invoice' then
    v_event_type := 'invoice';
  end if;

  if v_event_type not in ('order', 'booking', 'task', 'project', 'invoice', 'finance', 'client', 'deadline', 'system') then
    v_event_type := 'system';
  end if;

  insert into public.telegram_outbox (workspace_id, notification_id, event_type, entity_type, entity_id, payload)
  values (
    new.workspace_id,
    new.id,
    v_event_type,
    v_entity_type,
    v_entity_id,
    jsonb_build_object('title', new.title, 'body', coalesce(new.body, ''), 'kind', new.kind::text)
  )
  on conflict (notification_id) do nothing;
  return new;
end;
$enqueue_notification_for_telegram$;

revoke all on function public.enqueue_notification_for_telegram() from public, anon, authenticated;

drop trigger if exists notifications_enqueue_telegram on public.notifications;
create trigger notifications_enqueue_telegram
after insert on public.notifications
for each row execute function public.enqueue_notification_for_telegram();

create or replace function public.notify_telegram_task_change()
returns trigger
language plpgsql
set search_path = public
as $notify_telegram_task_change$
declare
  v_project_name text;
begin
  select name into v_project_name from public.projects where id = new.project_id;
  if tg_op = 'INSERT' then
    insert into public.notifications (workspace_id, kind, title, body, entity_type, entity_id)
    values (new.workspace_id, 'task', 'Task baru', new.name || ' ditambahkan ke ' || coalesce(v_project_name, 'project') || '.', 'project_task', new.id);
  elsif old.status is distinct from new.status or old.progress_percentage is distinct from new.progress_percentage then
    insert into public.notifications (workspace_id, kind, title, body, entity_type, entity_id)
    values (new.workspace_id, 'task', 'Task diperbarui', new.name || ' sekarang berstatus ' || replace(new.status::text, '_', ' ') || ' (' || new.progress_percentage || '%).', 'project_task', new.id);
  end if;
  return new;
end;
$notify_telegram_task_change$;

drop trigger if exists project_tasks_notify_telegram on public.project_tasks;
create trigger project_tasks_notify_telegram
after insert or update of status, progress_percentage on public.project_tasks
for each row execute function public.notify_telegram_task_change();

create or replace function public.notify_telegram_project_change()
returns trigger
language plpgsql
set search_path = public
as $notify_telegram_project_change$
begin
  if old.status is distinct from new.status or old.progress_percentage is distinct from new.progress_percentage then
    insert into public.notifications (workspace_id, kind, title, body, entity_type, entity_id)
    values (new.workspace_id, 'project', 'Project diperbarui', new.name || ' sekarang berstatus ' || replace(new.status::text, '_', ' ') || ' (' || new.progress_percentage || '%).', 'project', new.id);
  end if;
  return new;
end;
$notify_telegram_project_change$;

drop trigger if exists projects_notify_telegram_update on public.projects;
create trigger projects_notify_telegram_update
after update of status, progress_percentage on public.projects
for each row execute function public.notify_telegram_project_change();

create or replace function public.notify_telegram_invoice_change()
returns trigger
language plpgsql
set search_path = public
as $notify_telegram_invoice_change$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (workspace_id, kind, title, body, entity_type, entity_id)
    values (new.workspace_id, 'finance', 'Invoice baru', new.invoice_number || ' dibuat dengan total Rp ' || trim(to_char(new.total_amount, 'FM999G999G999G990')) || '.', 'invoice', new.id);
  elsif old.status is distinct from new.status then
    insert into public.notifications (workspace_id, kind, title, body, entity_type, entity_id)
    values (new.workspace_id, 'finance', 'Status invoice diperbarui', new.invoice_number || ' sekarang berstatus ' || new.status::text || '.', 'invoice', new.id);
  end if;
  return new;
end;
$notify_telegram_invoice_change$;

drop trigger if exists invoices_notify_telegram on public.invoices;
create trigger invoices_notify_telegram
after insert or update of status on public.invoices
for each row execute function public.notify_telegram_invoice_change();

-- Pastikan row pengaturan tersedia untuk semua workspace saat ini.
insert into public.telegram_integrations (workspace_id, timezone)
select workspace.id, coalesce(profile.timezone, 'Asia/Makassar')
from public.workspaces workspace
left join public.user_profiles profile on profile.id = workspace.owner_id
on conflict (workspace_id) do nothing;

-- Worker memproses outbox dan reminder setiap menit. Edge Function tetap
-- melakukan deduplikasi sehingga satu slot reminder hanya terkirim sekali.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $schedule_telegram_worker$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'nayagement-telegram-dispatch' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'nayagement-telegram-dispatch',
    '* * * * *',
    $cron$select net.http_post(
      url := 'https://mkydicbdotvqvbzbeeqv.supabase.co/functions/v1/telegram-bot?mode=dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_publishable__66m4Y8mJLcJRBPLMp3hjw_BHT61ZmO'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );$cron$
  );
end;
$schedule_telegram_worker$;

select
  to_regclass('public.telegram_integrations') is not null as integration_ready,
  to_regclass('public.telegram_outbox') is not null as outbox_ready,
  exists(select 1 from cron.job where jobname = 'nayagement-telegram-dispatch') as worker_scheduled;
