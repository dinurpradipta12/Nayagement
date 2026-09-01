-- Nayagement: ketersediaan konsultasi mingguan.
-- Jalankan setelah consultation-bookings.sql.

create table if not exists public.consultation_weekly_availability (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  is_enabled boolean not null default false,
  times jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, weekday),
  constraint consultation_weekly_times_array check (jsonb_typeof(times) = 'array')
);

create index if not exists consultation_weekly_availability_workspace_idx
  on public.consultation_weekly_availability (workspace_id, weekday);

drop trigger if exists consultation_weekly_availability_set_updated_at on public.consultation_weekly_availability;
create trigger consultation_weekly_availability_set_updated_at
before update on public.consultation_weekly_availability
for each row execute function public.set_updated_at();

alter table public.consultation_weekly_availability enable row level security;

drop policy if exists workspace_member_manage on public.consultation_weekly_availability;
create policy workspace_member_manage
on public.consultation_weekly_availability
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

revoke all on public.consultation_weekly_availability from anon;
grant select, insert, update, delete on public.consultation_weekly_availability to authenticated;
grant select, insert, update, delete on public.consultation_weekly_availability to service_role;

create or replace function public.refresh_consultation_slots(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $refresh_consultation_slots$
declare
  v_timezone text;
  v_duration integer;
  v_date date;
  v_time text;
  v_start timestamptz;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Akses workspace tidak valid';
  end if;

  select timezone, duration_minutes
  into v_timezone, v_duration
  from public.consultation_settings
  where workspace_id = p_workspace_id;

  v_timezone := coalesce(nullif(v_timezone, ''), 'Asia/Makassar');
  v_duration := coalesce(v_duration, 60);

  -- Jadwal yang sudah dibooking tidak pernah dihapus.
  delete from public.consultation_slots slot
  where slot.workspace_id = p_workspace_id
    and slot.starts_at >= timezone('utc', now())
    and not exists (
      select 1 from public.consultation_bookings booking
      where booking.slot_id = slot.id
        and booking.status <> 'cancelled'
    );

  for v_date in
    select day::date
    from generate_series(current_date, current_date + 90, interval '1 day') as day
  loop
    for v_time in
      select jsonb_array_elements_text(rule.times)
      from public.consultation_weekly_availability rule
      where rule.workspace_id = p_workspace_id
        and rule.is_enabled = true
        and rule.weekday = extract(isodow from v_date)::smallint
    loop
      if v_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
        v_start := (v_date + v_time::time) at time zone v_timezone;
        if v_start > timezone('utc', now()) then
          insert into public.consultation_slots (workspace_id, starts_at, ends_at, is_active)
          values (p_workspace_id, v_start, v_start + make_interval(mins => v_duration), true)
          on conflict (workspace_id, starts_at)
          do update set ends_at = excluded.ends_at, is_active = true;
        end if;
      end if;
    end loop;
  end loop;
end;
$refresh_consultation_slots$;

revoke all on function public.refresh_consultation_slots(uuid) from public;
grant execute on function public.refresh_consultation_slots(uuid) to authenticated;
