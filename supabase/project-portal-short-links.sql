-- Nayagement: short client portal links
-- Run this file once in the Supabase SQL Editor for an existing project.

begin;

alter table public.project_public_access
  add column if not exists public_code text;

create or replace function public.generate_project_public_code()
returns text
language plpgsql
volatile
set search_path = public
as $generate_project_public_code$
declare
  v_code text;
begin
  loop
    v_code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1
      from public.project_public_access
      where public_code = v_code
    );
  end loop;
  return v_code;
end;
$generate_project_public_code$;

update public.project_public_access
set public_code = public.generate_project_public_code()
where public_code is null or btrim(public_code) = '';

alter table public.project_public_access
  alter column public_code set default public.generate_project_public_code();

alter table public.project_public_access
  alter column public_code set not null;

create unique index if not exists project_public_access_public_code_key
  on public.project_public_access (public_code);

alter table public.project_public_access
  drop constraint if exists project_public_access_public_code_format;

alter table public.project_public_access
  add constraint project_public_access_public_code_format
  check (public_code ~ '^[a-z0-9]{8}$');

create or replace function public.get_public_project_by_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $get_public_project_by_code$
declare
  v_token text;
begin
  select public_token
  into v_token
  from public.project_public_access
  where public_code = lower(trim(p_code))
    and is_enabled = true
    and revoked_at is null;

  if v_token is null then
    return null;
  end if;

  return public.get_public_project(v_token);
end;
$get_public_project_by_code$;

revoke all on function public.get_public_project_by_code(text) from public;
grant execute on function public.get_public_project_by_code(text) to anon, authenticated;

commit;
