-- Nayagement: nomor WhatsApp follow-up untuk booking konsultasi.
-- Jalankan setelah SQL booking konsultasi sebelumnya.

alter table public.consultation_settings
  add column if not exists whatsapp_number text;

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
      select jsonb_agg(
        jsonb_build_object('id', slot.id, 'starts_at', slot.starts_at, 'ends_at', slot.ends_at)
        order by slot.starts_at
      )
      from public.consultation_slots slot
      where slot.workspace_id = v_settings.workspace_id
        and slot.is_active = true
        and slot.starts_at > timezone('utc', now())
        and not exists (
          select 1
          from public.consultation_bookings booking
          where booking.slot_id = slot.id
            and booking.status <> 'cancelled'
        )
    ), '[]'::jsonb)
  );
end;
$get_public_consultation_booking$;

revoke all on function public.get_public_consultation_booking() from public;
grant execute on function public.get_public_consultation_booking() to anon, authenticated;
