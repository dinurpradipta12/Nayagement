-- Nayagement: readable client portal links
-- Run this file once in the Supabase SQL Editor after the base schema is installed.
-- It is safe for existing project portal rows and does not remove legacy links.

begin;

alter table public.project_public_access
  add column if not exists public_slug text;

create or replace function public.slugify_project_public_name(p_value text)
returns text
language sql
immutable
set search_path = public
as $slugify_project_public_name$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '-', 'g')), ''),
    'project'
  );
$slugify_project_public_name$;

create or replace function public.generate_project_public_slug(p_project_id uuid)
returns text
language plpgsql
volatile
set search_path = public
as $generate_project_public_slug$
declare
  v_base text;
  v_candidate text;
  v_suffix integer := 2;
begin
  select public.slugify_project_public_name(name)
  into v_base
  from public.projects
  where id = p_project_id;

  v_base := coalesce(nullif(v_base, ''), 'project');
  v_candidate := v_base;
  while exists (
    select 1
    from public.project_public_access
    where public_slug = v_candidate
  ) loop
    v_candidate := v_base || '-' || v_suffix;
    v_suffix := v_suffix + 1;
  end loop;
  return v_candidate;
end;
$generate_project_public_slug$;

update public.project_public_access
set public_slug = public.generate_project_public_slug(project_id)
where public_slug is null or btrim(public_slug) = '';

alter table public.project_public_access
  alter column public_slug set not null;

create unique index if not exists project_public_access_public_slug_key
  on public.project_public_access (public_slug);

alter table public.project_public_access
  drop constraint if exists project_public_access_public_slug_format;

alter table public.project_public_access
  add constraint project_public_access_public_slug_format
  check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create or replace function public.set_project_public_slug()
returns trigger
language plpgsql
set search_path = public
as $set_project_public_slug$
begin
  if new.public_slug is null or btrim(new.public_slug) = '' then
    new.public_slug := public.generate_project_public_slug(new.project_id);
  else
    new.public_slug := public.slugify_project_public_name(new.public_slug);
  end if;
  return new;
end;
$set_project_public_slug$;

drop trigger if exists project_public_access_set_public_slug on public.project_public_access;
create trigger project_public_access_set_public_slug
before insert or update of project_id, public_slug on public.project_public_access
for each row execute function public.set_project_public_slug();

create or replace function public.get_public_project_by_slug(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $get_public_project_by_slug$
declare
  v_token text;
begin
  select public_token
  into v_token
  from public.project_public_access
  where public_slug = lower(trim(p_slug))
    and is_enabled = true
    and revoked_at is null;

  if v_token is null then
    return null;
  end if;

  return public.get_public_project(v_token);
end;
$get_public_project_by_slug$;

revoke all on function public.get_public_project_by_slug(text) from public;
grant execute on function public.get_public_project_by_slug(text) to anon, authenticated;

commit;
