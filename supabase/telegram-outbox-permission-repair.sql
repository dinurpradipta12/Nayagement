-- Nayagement: repair trigger access to the private Telegram outbox.
-- Jalankan seluruh file ini di Supabase SQL Editor.
-- Tabel telegram_outbox tetap tidak dapat ditulis langsung dari browser.

begin;

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

  insert into public.telegram_outbox (
    workspace_id,
    notification_id,
    event_type,
    entity_type,
    entity_id,
    payload
  )
  values (
    new.workspace_id,
    new.id,
    v_event_type,
    v_entity_type,
    v_entity_id,
    jsonb_build_object(
      'title', new.title,
      'body', coalesce(new.body, ''),
      'kind', new.kind::text
    )
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

commit;

select
  p.prosecdef as trigger_uses_security_definer,
  has_table_privilege('authenticated', 'public.telegram_outbox', 'insert') as browser_can_insert_outbox
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'enqueue_notification_for_telegram';
