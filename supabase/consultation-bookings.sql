-- Nayagement: Booking Konsultasi
-- Jalankan seluruh blok ini di Supabase SQL Editor, lalu muat ulang aplikasi.

create table if not exists public.consultation_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  title text not null default 'Booking konsultasi' check (char_length(trim(title)) between 2 and 160),
  subtitle text,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 240),
  timezone text not null default 'Asia/Makassar',
  instructions text,
  whatsapp_number text,
  is_public boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.consultation_slots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint consultation_slot_times_valid check (ends_at > starts_at),
  unique (workspace_id, starts_at)
);

-- URL publik dibuat pendek sebagai #/booking, jadi hanya satu halaman booking
-- aktif yang dapat dipublikasikan untuk satu aplikasi ini pada satu waktu.
create unique index if not exists consultation_one_public_page
  on public.consultation_settings ((is_public))
  where is_public;

create table if not exists public.consultation_bookings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slot_id uuid not null references public.consultation_slots(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  email text,
  whatsapp text,
  topic text not null check (char_length(trim(topic)) between 2 and 240),
  details text,
  status text not null default 'new' check (status in ('new', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint consultation_booking_times_valid check (ends_at > starts_at)
);

create unique index if not exists consultation_one_active_booking_per_slot
  on public.consultation_bookings (slot_id)
  where status <> 'cancelled';
create index if not exists consultation_slots_workspace_starts_idx on public.consultation_slots (workspace_id, starts_at);
create index if not exists consultation_bookings_workspace_starts_idx on public.consultation_bookings (workspace_id, starts_at);

drop trigger if exists consultation_settings_set_updated_at on public.consultation_settings;
create trigger consultation_settings_set_updated_at before update on public.consultation_settings
for each row execute function public.set_updated_at();
drop trigger if exists consultation_slots_set_updated_at on public.consultation_slots;
create trigger consultation_slots_set_updated_at before update on public.consultation_slots
for each row execute function public.set_updated_at();
drop trigger if exists consultation_bookings_set_updated_at on public.consultation_bookings;
create trigger consultation_bookings_set_updated_at before update on public.consultation_bookings
for each row execute function public.set_updated_at();

alter table public.consultation_settings enable row level security;
alter table public.consultation_slots enable row level security;
alter table public.consultation_bookings enable row level security;

drop policy if exists workspace_member_manage on public.consultation_settings;
create policy workspace_member_manage on public.consultation_settings for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists workspace_member_manage on public.consultation_slots;
create policy workspace_member_manage on public.consultation_slots for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists workspace_member_manage on public.consultation_bookings;
create policy workspace_member_manage on public.consultation_bookings for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

revoke all on public.consultation_settings, public.consultation_slots, public.consultation_bookings from anon;
grant select, insert, update, delete on public.consultation_settings, public.consultation_slots, public.consultation_bookings to authenticated;
grant select, insert, update, delete on public.consultation_settings, public.consultation_slots, public.consultation_bookings to service_role;

create or replace function public.get_public_consultation_booking()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $get_public_consultation_booking$
declare
  v_settings public.consultation_settings%rowtype;
begin
  select * into v_settings
  from public.consultation_settings
  where is_public = true
  order by updated_at desc
  limit 1;

  if not found then return null; end if;

  return jsonb_build_object(
    'title', v_settings.title,
    'subtitle', v_settings.subtitle,
    'duration_minutes', v_settings.duration_minutes,
    'timezone', v_settings.timezone,
    'instructions', v_settings.instructions,
    'whatsapp_number', v_settings.whatsapp_number,
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object('id', slot.id, 'starts_at', slot.starts_at, 'ends_at', slot.ends_at) order by slot.starts_at)
      from public.consultation_slots slot
      where slot.workspace_id = v_settings.workspace_id
        and slot.is_active = true
        and slot.starts_at > timezone('utc', now())
        and not exists (
          select 1 from public.consultation_bookings booking
          where booking.slot_id = slot.id and booking.status <> 'cancelled'
        )
    ), '[]'::jsonb)
  );
end;
$get_public_consultation_booking$;

create or replace function public.submit_public_consultation_booking(
  p_slot_id uuid,
  p_name text,
  p_email text,
  p_whatsapp text,
  p_topic text,
  p_details text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $submit_public_consultation_booking$
declare
  v_slot public.consultation_slots%rowtype;
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_whatsapp text := nullif(trim(coalesce(p_whatsapp, '')), '');
  v_topic text := nullif(trim(coalesce(p_topic, '')), '');
  v_booking_id uuid;
begin
  if v_name is null or char_length(v_name) < 2 then raise exception 'Nama lengkap wajib diisi'; end if;
  if v_whatsapp is null or char_length(v_whatsapp) < 6 then raise exception 'Nomor WhatsApp wajib diisi'; end if;
  if v_topic is null or char_length(v_topic) < 2 then raise exception 'Topik konsultasi wajib diisi'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email tidak valid'; end if;

  select * into v_slot from public.consultation_slots where id = p_slot_id for update;
  if not found or not v_slot.is_active or v_slot.starts_at <= timezone('utc', now()) then
    raise exception 'Jadwal ini sudah tidak tersedia';
  end if;
  if exists (select 1 from public.consultation_bookings where slot_id = v_slot.id and status <> 'cancelled') then
    raise exception 'Jadwal ini baru saja dibooking. Pilih jam lain.';
  end if;

  insert into public.consultation_bookings (workspace_id, slot_id, starts_at, ends_at, name, email, whatsapp, topic, details)
  values (v_slot.workspace_id, v_slot.id, v_slot.starts_at, v_slot.ends_at, v_name, v_email, v_whatsapp, v_topic, nullif(trim(coalesce(p_details, '')), ''))
  returning id into v_booking_id;

  insert into public.notifications (workspace_id, kind, title, body)
  values (v_slot.workspace_id, 'system', 'Booking konsultasi baru', v_name || ' memilih jadwal konsultasi.');

  return jsonb_build_object('id', v_booking_id, 'message', 'Booking konsultasi berhasil dikirim.');
end;
$submit_public_consultation_booking$;

revoke all on function public.get_public_consultation_booking() from public;
revoke all on function public.submit_public_consultation_booking(uuid, text, text, text, text, text) from public;
grant execute on function public.get_public_consultation_booking() to anon, authenticated;
grant execute on function public.submit_public_consultation_booking(uuid, text, text, text, text, text) to anon, authenticated;
