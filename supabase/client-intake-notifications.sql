-- Nayagement: client intake and review notifications
-- Run this file once in the Supabase SQL Editor for the existing project.
-- It is safe to run again: functions and triggers are replaced idempotently.

create or replace function public.notify_new_order_submission()
returns trigger
language plpgsql
set search_path = public
as $notify_new_order_submission$
begin
  insert into public.notifications (workspace_id, kind, title, body, entity_type, entity_id)
  values (
    new.workspace_id,
    'order',
    'Order baru masuk',
    new.submitter_name || ' mengirimkan brief baru untuk ditinjau.',
    'order_submission',
    new.id
  );
  return new;
end;
$notify_new_order_submission$;

drop trigger if exists order_submissions_notify_new on public.order_submissions;
create trigger order_submissions_notify_new
after insert on public.order_submissions
for each row execute function public.notify_new_order_submission();

create or replace function public.notify_new_client()
returns trigger
language plpgsql
set search_path = public
as $notify_new_client$
begin
  insert into public.notifications (workspace_id, kind, title, body, entity_type, entity_id)
  values (
    new.workspace_id,
    'client',
    'Klien baru masuk',
    coalesce(nullif(trim(new.company), ''), new.name) || ' ditambahkan dan siap ditinjau.',
    'client',
    new.id
  );
  return new;
end;
$notify_new_client$;

drop trigger if exists clients_notify_new on public.clients;
create trigger clients_notify_new
after insert on public.clients
for each row execute function public.notify_new_client();

create or replace function public.notify_new_project()
returns trigger
language plpgsql
set search_path = public
as $notify_new_project$
begin
  insert into public.notifications (workspace_id, kind, title, body, entity_type, entity_id)
  values (
    new.workspace_id,
    'project',
    'Proyek baru masuk untuk ditinjau',
    new.name || ' ditambahkan ke workspace dan menunggu peninjauan.',
    'project',
    new.id
  );
  return new;
end;
$notify_new_project$;

drop trigger if exists projects_notify_new on public.projects;
create trigger projects_notify_new
after insert on public.projects
for each row execute function public.notify_new_project();

do $publish_clients$
begin
  alter publication supabase_realtime add table public.clients;
exception when duplicate_object then null; end;
$publish_clients$;
