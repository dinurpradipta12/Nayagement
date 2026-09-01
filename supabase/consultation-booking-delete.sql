begin;

create or replace function public.delete_workspace_consultation_booking(
  p_workspace_id uuid,
  p_booking_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $delete_workspace_consultation_booking$
declare
  v_deleted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sesi tidak ditemukan';
  end if;

  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Anda tidak memiliki akses ke workspace ini';
  end if;

  delete from public.consultation_bookings
  where id = p_booking_id
    and workspace_id = p_workspace_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Booking tidak ditemukan';
  end if;

  return v_deleted_id;
end;
$delete_workspace_consultation_booking$;

revoke all on function public.delete_workspace_consultation_booking(uuid, uuid) from public;
revoke all on function public.delete_workspace_consultation_booking(uuid, uuid) from anon;
grant execute on function public.delete_workspace_consultation_booking(uuid, uuid) to authenticated;
grant execute on function public.delete_workspace_consultation_booking(uuid, uuid) to service_role;

commit;
