-- Nayagement: unggah gambar header lokal untuk public order forms.
-- Jalankan seluruh file ini sekali di Supabase SQL Editor untuk database yang sudah ada.

begin;

alter table public.order_forms
  add column if not exists header_image_url text;

update public.order_forms
set header_image_url = null
where header_image_url is not null and btrim(header_image_url) = '';

alter table public.order_forms
  drop constraint if exists order_forms_header_image_url_format;

alter table public.order_forms
  drop constraint if exists order_forms_header_image_url_check;

alter table public.order_forms
  add constraint order_forms_header_image_url_format
  check (header_image_url is null or header_image_url ~ '^https?://[^[:space:]]+$');

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nayagement-order-headers',
  'nayagement-order-headers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists order_form_header_upload on storage.objects;
create policy order_form_header_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'nayagement-order-headers'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

create or replace function public.get_public_order_form(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $get_public_order_form$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'title', oform.title,
    'description', oform.description,
    'confirmation_message', oform.confirmation_message,
    'header_image_url', oform.header_image_url,
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', f.field_key,
        'label', f.label,
        'type', f.field_type,
        'options', f.options,
        'required', f.is_required
      ) order by f.sort_order asc)
      from public.order_form_fields f
      where f.order_form_id = oform.id
    ), '[]'::jsonb)
  ) into v_result
  from public.order_forms oform
  where oform.public_token = p_token and oform.is_active = true;

  return v_result;
end;
$get_public_order_form$;

notify pgrst, 'reload schema';

commit;
