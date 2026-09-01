-- Nayagement Supabase schema
-- Run this file once in the Supabase SQL Editor for a fresh project.
-- The browser only receives VITE_SUPABASE_URL plus a publishable or legacy anon key.

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.workspace_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_status as enum ('lead', 'active', 'inactive', 'returning');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_status as enum ('inquiry', 'pending', 'confirmed', 'in_progress', 'review', 'revision', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('todo', 'in_progress', 'review', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('unpaid', 'partial', 'paid', 'overdue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_visibility as enum ('internal', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_submission_status as enum ('new', 'reviewing', 'accepted', 'rejected', 'converted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_kind as enum ('project', 'task', 'order', 'finance', 'deadline', 'client', 'system');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Utilities
-- -----------------------------------------------------------------------------
create or replace function public.generate_secure_token()
returns text
language sql
volatile
set search_path = public
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.generate_project_code()
returns text
language sql
volatile
set search_path = public
as $$
  select 'NAYA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

create or replace function public.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Identity and tenancy
-- -----------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Nayagement user',
  avatar_url text,
  timezone text not null default 'Asia/Makassar',
  full_name text,
  username text check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  phone text,
  bio text,
  role_title text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Kept private: this maps an admin-facing username to the internal Auth email.
-- Never select this table from browser code. The Edge Function uses service role.
create table if not exists public.admin_login_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  login_email text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text unique,
  description text,
  logo_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists user_profiles_username_lower_key
  on public.user_profiles (lower(username))
  where username is not null and btrim(username) <> '';

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id)
);

-- Every record created by the initial demo seeder is associated with one batch.
-- The whole batch can later be deleted safely with clear_demo_seed(batch_id).
create table if not exists public.demo_seed_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label text not null default 'initial-ui-demo',
  created_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, label)
);

-- -----------------------------------------------------------------------------
-- Core business entities
-- -----------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  demo_seed_id uuid references public.demo_seed_batches(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  company text,
  whatsapp text,
  email text,
  instagram text,
  tiktok text,
  linkedin text,
  website text,
  address text,
  description text,
  notes text,
  logo_path text,
  status public.client_status not null default 'lead',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  demo_seed_id uuid references public.demo_seed_batches(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 80),
  color text not null default '#5B8EE6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, name)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  demo_seed_id uuid references public.demo_seed_batches(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  project_type_id uuid references public.project_types(id) on delete set null,
  code text not null default public.generate_project_code(),
  name text not null check (char_length(trim(name)) between 2 and 180),
  description text,
  client_visible_description text,
  status public.project_status not null default 'inquiry',
  priority public.project_priority not null default 'medium',
  start_date date,
  deadline date,
  estimated_value numeric(14,2) not null default 0 check (estimated_value >= 0),
  final_value numeric(14,2) check (final_value is null or final_value >= 0),
  payment_status public.payment_status not null default 'unpaid',
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  progress_percentage smallint not null default 0 check (progress_percentage between 0 and 100),
  assigned_to uuid references auth.users(id) on delete set null,
  internal_notes text,
  client_visibility boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, code),
  constraint valid_project_dates check (deadline is null or start_date is null or deadline >= start_date)
);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 180),
  description text,
  brief text,
  status public.task_status not null default 'todo',
  priority public.project_priority not null default 'medium',
  due_at timestamptz,
  progress_percentage smallint not null default 0 check (progress_percentage between 0 and 100),
  assigned_to uuid references auth.users(id) on delete set null,
  client_visible boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_task_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 10000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_task_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  storage_path text not null unique check (char_length(trim(storage_path)) between 1 and 500),
  mime_type text,
  file_size bigint not null default 0 check (file_size >= 0 and file_size <= 15728640),
  caption text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_timeline (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text,
  occurred_at timestamptz not null default timezone('utc', now()),
  status_snapshot public.project_status,
  visibility public.activity_visibility not null default 'internal',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_public_access (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  public_token text not null unique default public.generate_secure_token() check (char_length(public_token) >= 48),
  public_code text not null unique check (public_code ~ '^[a-z0-9]{8}$'),
  public_slug text not null unique check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_enabled boolean not null default true,
  show_client_name boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz
);

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

alter table public.project_public_access
  alter column public_code set default public.generate_project_public_code();

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

-- -----------------------------------------------------------------------------
-- Order forms and submissions
-- -----------------------------------------------------------------------------
create table if not exists public.order_forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  demo_seed_id uuid references public.demo_seed_batches(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text,
  confirmation_message text not null default 'Terima kasih, brief Anda sudah kami terima.',
  header_image_url text check (header_image_url is null or header_image_url ~ '^https?://[^[:space:]]+$'),
  public_token text not null unique default public.generate_secure_token() check (char_length(public_token) >= 48),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.order_form_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_form_id uuid not null references public.order_forms(id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  label text not null check (char_length(trim(label)) between 2 and 120),
  field_type text not null check (field_type in ('text', 'email', 'phone', 'textarea', 'select', 'date', 'number', 'url', 'file')),
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (order_form_id, field_key)
);

create table if not exists public.order_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  demo_seed_id uuid references public.demo_seed_batches(id) on delete set null,
  order_form_id uuid not null references public.order_forms(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  submitter_name text not null,
  submitter_email text,
  submitter_whatsapp text,
  payload jsonb not null default '{}'::jsonb,
  status public.order_submission_status not null default 'new',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.order_submission_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_submission_id uuid not null references public.order_submissions(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  created_at timestamptz not null default timezone('utc', now())
);

-- -----------------------------------------------------------------------------
-- Finance
-- -----------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  demo_seed_id uuid references public.demo_seed_batches(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date,
  status public.invoice_status not null default 'draft',
  currency text not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  payment_instructions text,
  notes text,
  document_title text not null default 'Invoice',
  brand_color text not null default '#30343b' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path text,
  signature_path text,
  recipient_name text,
  recipient_company text,
  recipient_email text,
  recipient_whatsapp text,
  sender_name text,
  sender_email text,
  sender_phone text,
  sender_address text,
  terms text,
  footer_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, invoice_number),
  constraint valid_invoice_dates check (due_date is null or due_date >= issue_date)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 2 and 240),
  detail text,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default timezone('utc', now()),
  method text,
  reference text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_payment_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default timezone('utc', now()),
  method text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

-- Saved service rates and price quotes stay separate from invoices until a quote
-- is explicitly converted into an invoice by the application.
create table if not exists public.service_catalogs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 240),
  category text not null default 'Lainnya' check (char_length(trim(category)) between 2 and 120),
  description text,
  pricing_mode text not null default 'package' check (pricing_mode in ('fixed', 'per_hour', 'per_unit', 'package')),
  minimum_fee numeric(14,2) not null default 0 check (minimum_fee >= 0),
  default_unit_label text not null default 'paket' check (char_length(trim(default_unit_label)) between 1 and 80),
  default_unit_price numeric(14,2) not null default 0 check (default_unit_price >= 0),
  default_quantity numeric(10,2) not null default 1 check (default_quantity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.service_quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  converted_invoice_id uuid references public.invoices(id) on delete set null,
  quote_number text not null,
  title text not null default 'Penawaran layanan' check (char_length(trim(title)) between 2 and 240),
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'expired', 'converted')),
  currency text not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  issue_date date not null default current_date,
  valid_until date,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, quote_number),
  constraint valid_service_quote_dates check (valid_until is null or valid_until >= issue_date)
);

create table if not exists public.service_quote_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  quote_id uuid not null references public.service_quotes(id) on delete cascade,
  catalog_id uuid references public.service_catalogs(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 240),
  detail text,
  pricing_mode text not null default 'package' check (pricing_mode in ('fixed', 'per_hour', 'per_unit', 'package')),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_label text not null default 'paket' check (char_length(trim(unit_label)) between 1 and 80),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  minimum_fee numeric(14,2) not null default 0 check (minimum_fee >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- -----------------------------------------------------------------------------
-- Supporting modules
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  demo_seed_id uuid references public.demo_seed_batches(id) on delete set null,
  recipient_id uuid references auth.users(id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(trim(title)) between 2 and 180),
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  demo_seed_id uuid references public.demo_seed_batches(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.project_tasks(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint valid_event_dates check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  setting_key text not null check (setting_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  setting_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, setting_key)
);

create table if not exists public.business_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  business_name text not null default 'Nayagement Studio',
  logo_path text,
  address text,
  whatsapp text,
  email text,
  website text,
  social_links jsonb not null default '{}'::jsonb,
  invoice_prefix text not null default 'INV',
  invoice_number_format text not null default '{prefix}/{sequence}/{month}/{year}',
  next_invoice_number integer not null default 1 check (next_invoice_number > 0),
  default_payment_instructions text,
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists clients_workspace_status_idx on public.clients (workspace_id, status);
create index if not exists clients_demo_seed_idx on public.clients (demo_seed_id) where demo_seed_id is not null;
create index if not exists clients_workspace_name_idx on public.clients (workspace_id, lower(name));
create index if not exists clients_workspace_company_idx on public.clients (workspace_id, lower(company));
create index if not exists projects_workspace_status_deadline_idx on public.projects (workspace_id, status, deadline);
create index if not exists projects_demo_seed_idx on public.projects (demo_seed_id) where demo_seed_id is not null;
create index if not exists projects_workspace_client_idx on public.projects (workspace_id, client_id);
create index if not exists projects_workspace_type_idx on public.projects (workspace_id, project_type_id);
create index if not exists project_tasks_workspace_due_idx on public.project_tasks (workspace_id, due_at) where status <> 'completed';
create index if not exists project_tasks_project_idx on public.project_tasks (project_id, status);
create index if not exists project_task_notes_task_created_idx on public.project_task_notes (task_id, created_at desc);
create index if not exists project_task_attachments_task_created_idx on public.project_task_attachments (task_id, created_at desc);
create index if not exists project_timeline_project_occurred_idx on public.project_timeline (project_id, occurred_at desc);
create index if not exists project_public_access_token_idx on public.project_public_access (public_token) where is_enabled;
create index if not exists order_forms_token_idx on public.order_forms (public_token) where is_active;
create index if not exists order_forms_demo_seed_idx on public.order_forms (demo_seed_id) where demo_seed_id is not null;
create index if not exists order_submissions_workspace_status_idx on public.order_submissions (workspace_id, status, created_at desc);
create index if not exists order_submissions_demo_seed_idx on public.order_submissions (demo_seed_id) where demo_seed_id is not null;
create index if not exists invoices_workspace_status_due_idx on public.invoices (workspace_id, status, due_date);
create index if not exists invoices_demo_seed_idx on public.invoices (demo_seed_id) where demo_seed_id is not null;
create index if not exists payments_invoice_idx on public.payments (invoice_id, paid_at desc);
create index if not exists project_payment_records_workspace_paid_at_idx on public.project_payment_records (workspace_id, paid_at desc);
create index if not exists project_payment_records_project_paid_at_idx on public.project_payment_records (project_id, paid_at desc);
create index if not exists service_catalogs_workspace_active_idx on public.service_catalogs (workspace_id, is_active, updated_at desc);
create index if not exists service_quotes_workspace_updated_idx on public.service_quotes (workspace_id, updated_at desc);
create index if not exists service_quotes_workspace_status_idx on public.service_quotes (workspace_id, status, issue_date desc);
create index if not exists service_quote_items_quote_sort_idx on public.service_quote_items (quote_id, sort_order);
create index if not exists notifications_recipient_created_idx on public.notifications (recipient_id, read_at, created_at desc);
create index if not exists notifications_demo_seed_idx on public.notifications (demo_seed_id) where demo_seed_id is not null;
create index if not exists calendar_events_workspace_start_idx on public.calendar_events (workspace_id, starts_at);
create index if not exists calendar_events_demo_seed_idx on public.calendar_events (demo_seed_id) where demo_seed_id is not null;

-- -----------------------------------------------------------------------------
-- Automatic timestamps and business events
-- -----------------------------------------------------------------------------
create or replace function public.sync_project_payment_status()
returns trigger
language plpgsql
set search_path = public
as $sync_project_payment_status$
begin
  new.paid_amount := greatest(coalesce(new.paid_amount, 0), 0);
  new.payment_status := case
    when new.estimated_value > 0 and new.paid_amount >= new.estimated_value then 'paid'::public.payment_status
    when new.paid_amount > 0 then 'partial'::public.payment_status
    else 'unpaid'::public.payment_status
  end;
  return new;
end;
$sync_project_payment_status$;

drop trigger if exists projects_sync_payment_status_on_insert on public.projects;
create trigger projects_sync_payment_status_on_insert
before insert on public.projects
for each row execute function public.sync_project_payment_status();

drop trigger if exists projects_sync_payment_status_on_payment on public.projects;
create trigger projects_sync_payment_status_on_payment
before update of paid_amount, estimated_value on public.projects
for each row execute function public.sync_project_payment_status();

create or replace function public.record_project_payment(
  p_workspace_id uuid,
  p_project_id uuid,
  p_amount numeric,
  p_paid_at timestamptz default timezone('utc', now()),
  p_method text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
set search_path = public
as $record_project_payment$
declare
  v_estimated numeric(14,2);
  v_current numeric(14,2);
  v_amount numeric(14,2);
  v_next numeric(14,2);
  v_payment_id uuid;
  v_paid_at timestamptz;
begin
  if p_workspace_id is null or not public.is_workspace_member(p_workspace_id) then
    raise exception 'Tidak memiliki akses ke workspace ini';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Nominal pembayaran harus lebih dari nol';
  end if;

  select coalesce(estimated_value, 0), coalesce(paid_amount, 0)
  into v_estimated, v_current
  from public.projects
  where id = p_project_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Proyek tidak ditemukan';
  end if;

  v_amount := round(p_amount);
  if v_estimated > 0 then
    if v_current >= v_estimated then
      raise exception 'Pembayaran proyek ini sudah lunas';
    end if;
    v_amount := least(v_amount, v_estimated - v_current);
  end if;

  v_paid_at := coalesce(p_paid_at, timezone('utc', now()));
  v_next := v_current + v_amount;

  insert into public.project_payment_records (workspace_id, project_id, amount, paid_at, method, notes)
  values (
    p_workspace_id,
    p_project_id,
    v_amount,
    v_paid_at,
    nullif(trim(coalesce(p_method, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  ) returning id into v_payment_id;

  update public.projects
  set
    paid_amount = v_next,
    payment_status = case
      when v_estimated > 0 and v_next >= v_estimated then 'paid'::public.payment_status
      when v_next > 0 then 'partial'::public.payment_status
      else 'unpaid'::public.payment_status
    end
  where id = p_project_id
    and workspace_id = p_workspace_id;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'amount', v_amount,
    'paid_at', v_paid_at,
    'project_paid_amount', v_next
  );
end;
$record_project_payment$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();
drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();
drop trigger if exists project_types_set_updated_at on public.project_types;
create trigger project_types_set_updated_at before update on public.project_types for each row execute function public.set_updated_at();
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
drop trigger if exists project_tasks_set_updated_at on public.project_tasks;
create trigger project_tasks_set_updated_at before update on public.project_tasks for each row execute function public.set_updated_at();
drop trigger if exists project_timeline_set_updated_at on public.project_timeline;
create trigger project_timeline_set_updated_at before update on public.project_timeline for each row execute function public.set_updated_at();
drop trigger if exists project_public_access_set_updated_at on public.project_public_access;
create trigger project_public_access_set_updated_at before update on public.project_public_access for each row execute function public.set_updated_at();
drop trigger if exists order_forms_set_updated_at on public.order_forms;
create trigger order_forms_set_updated_at before update on public.order_forms for each row execute function public.set_updated_at();
drop trigger if exists order_form_fields_set_updated_at on public.order_form_fields;
create trigger order_form_fields_set_updated_at before update on public.order_form_fields for each row execute function public.set_updated_at();
drop trigger if exists order_submissions_set_updated_at on public.order_submissions;
create trigger order_submissions_set_updated_at before update on public.order_submissions for each row execute function public.set_updated_at();
drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices for each row execute function public.set_updated_at();
drop trigger if exists invoice_items_set_updated_at on public.invoice_items;
create trigger invoice_items_set_updated_at before update on public.invoice_items for each row execute function public.set_updated_at();
drop trigger if exists service_catalogs_set_updated_at on public.service_catalogs;
create trigger service_catalogs_set_updated_at before update on public.service_catalogs for each row execute function public.set_updated_at();
drop trigger if exists service_quotes_set_updated_at on public.service_quotes;
create trigger service_quotes_set_updated_at before update on public.service_quotes for each row execute function public.set_updated_at();
drop trigger if exists service_quote_items_set_updated_at on public.service_quote_items;
create trigger service_quote_items_set_updated_at before update on public.service_quote_items for each row execute function public.set_updated_at();
drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();
drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at before update on public.calendar_events for each row execute function public.set_updated_at();
drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at before update on public.app_settings for each row execute function public.set_updated_at();
drop trigger if exists business_settings_set_updated_at on public.business_settings;
create trigger business_settings_set_updated_at before update on public.business_settings for each row execute function public.set_updated_at();

create or replace function public.set_task_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at = timezone('utc', now());
  elsif new.status <> 'completed' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists project_tasks_set_completed_at on public.project_tasks;
create trigger project_tasks_set_completed_at before update on public.project_tasks for each row execute function public.set_task_completed_at();

create or replace function public.add_status_timeline_item()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.project_timeline (workspace_id, project_id, title, description, occurred_at, status_snapshot, visibility, created_by)
    values (
      new.workspace_id,
      new.id,
      'Status proyek diperbarui',
      'Status berubah menjadi ' || replace(new.status::text, '_', ' ') || '.',
      timezone('utc', now()),
      new.status,
      'internal',
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists projects_add_status_timeline_item on public.projects;
create trigger projects_add_status_timeline_item after update of status on public.projects for each row execute function public.add_status_timeline_item();

create or replace function public.refresh_invoice_totals(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
  v_tax_rate numeric(5,2);
begin
  select coalesce(sum(quantity * unit_price), 0), coalesce(sum(discount_amount), 0)
  into v_subtotal, v_discount
  from public.invoice_items
  where invoice_id = p_invoice_id;

  select tax_rate into v_tax_rate from public.invoices where id = p_invoice_id;

  update public.invoices
  set subtotal = v_subtotal,
      discount_amount = v_discount,
      tax_amount = greatest((v_subtotal - v_discount) * coalesce(v_tax_rate, 0) / 100, 0),
      total_amount = greatest((v_subtotal - v_discount) * (1 + coalesce(v_tax_rate, 0) / 100), 0)
  where id = p_invoice_id;
end;
$$;

create or replace function public.refresh_invoice_totals_from_item()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_invoice_totals(old.invoice_id);
    return old;
  end if;

  perform public.refresh_invoice_totals(new.invoice_id);
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform public.refresh_invoice_totals(old.invoice_id);
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_items_refresh_totals on public.invoice_items;
create trigger invoice_items_refresh_totals after insert or update or delete on public.invoice_items for each row execute function public.refresh_invoice_totals_from_item();

create or replace function public.refresh_invoice_payment_status(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paid numeric(14,2);
  v_total numeric(14,2);
  v_project_id uuid;
  v_status public.invoice_status;
begin
  select coalesce(sum(amount), 0) into v_paid from public.payments where invoice_id = p_invoice_id;
  select total_amount, project_id into v_total, v_project_id from public.invoices where id = p_invoice_id;

  if v_total is null then return; end if;

  v_status := case
    when v_paid >= v_total and v_total > 0 then 'paid'::public.invoice_status
    when v_paid > 0 then 'sent'::public.invoice_status
    when exists (select 1 from public.invoices where id = p_invoice_id and due_date < current_date) then 'overdue'::public.invoice_status
    else 'sent'::public.invoice_status
  end;

  update public.invoices set status = v_status where id = p_invoice_id;

  if v_project_id is not null then
    update public.projects
    set payment_status = case
      when v_paid >= v_total and v_total > 0 then 'paid'::public.payment_status
      when v_paid > 0 then 'partial'::public.payment_status
      when v_status = 'overdue' then 'overdue'::public.payment_status
      else 'unpaid'::public.payment_status
    end
    where id = v_project_id;
  end if;
end;
$$;

create or replace function public.refresh_invoice_payment_status_from_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_invoice_payment_status(old.invoice_id);
    return old;
  end if;

  perform public.refresh_invoice_payment_status(new.invoice_id);
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform public.refresh_invoice_payment_status(old.invoice_id);
  end if;
  return new;
end;
$$;

drop trigger if exists payments_refresh_invoice_status on public.payments;
create trigger payments_refresh_invoice_status after insert or update or delete on public.payments for each row execute function public.refresh_invoice_payment_status_from_payment();

create or replace function public.refresh_service_quote_totals(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $refresh_service_quote_totals$
declare
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
  v_tax_rate numeric(5,2);
begin
  select coalesce(sum(greatest(minimum_fee, quantity * unit_price)), 0)
  into v_subtotal
  from public.service_quote_items
  where quote_id = p_quote_id;

  select discount_amount, tax_rate
  into v_discount, v_tax_rate
  from public.service_quotes
  where id = p_quote_id;

  if v_discount is null and v_tax_rate is null then return; end if;

  update public.service_quotes
  set subtotal = v_subtotal,
      tax_amount = greatest((v_subtotal - least(v_subtotal, coalesce(v_discount, 0))) * coalesce(v_tax_rate, 0) / 100, 0),
      total_amount = greatest((v_subtotal - least(v_subtotal, coalesce(v_discount, 0))) * (1 + coalesce(v_tax_rate, 0) / 100), 0)
  where id = p_quote_id;
end;
$refresh_service_quote_totals$;

create or replace function public.refresh_service_quote_totals_from_item()
returns trigger
language plpgsql
set search_path = public
as $refresh_service_quote_totals_from_item$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_service_quote_totals(old.quote_id);
    return old;
  end if;

  perform public.refresh_service_quote_totals(new.quote_id);
  if tg_op = 'UPDATE' and old.quote_id is distinct from new.quote_id then
    perform public.refresh_service_quote_totals(old.quote_id);
  end if;
  return new;
end;
$refresh_service_quote_totals_from_item$;

drop trigger if exists service_quote_items_refresh_totals on public.service_quote_items;
create trigger service_quote_items_refresh_totals after insert or update or delete on public.service_quote_items for each row execute function public.refresh_service_quote_totals_from_item();

create or replace function public.notify_new_order_submission()
returns trigger
language plpgsql
set search_path = public
as $$
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
$$;

drop trigger if exists order_submissions_notify_new on public.order_submissions;
create trigger order_submissions_notify_new after insert on public.order_submissions for each row execute function public.notify_new_order_submission();

create or replace function public.notify_new_client()
returns trigger
language plpgsql
set search_path = public
as $$
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
$$;

drop trigger if exists clients_notify_new on public.clients;
create trigger clients_notify_new after insert on public.clients for each row execute function public.notify_new_client();

create or replace function public.notify_new_project()
returns trigger
language plpgsql
set search_path = public
as $$
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
$$;

drop trigger if exists projects_notify_new on public.projects;
create trigger projects_notify_new after insert on public.projects for each row execute function public.notify_new_project();

-- -----------------------------------------------------------------------------
-- Auth bootstrap: create a personal workspace for a newly created Supabase user.
-- Set raw_user_meta_data.username when provisioning the private admin account.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_display_name text;
  v_workspace_id uuid;
begin
  v_username := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  v_display_name := coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), initcap(v_username::text));

  insert into public.user_profiles (id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do nothing;

  insert into public.admin_login_identities (user_id, username, login_email)
  values (new.id, v_username, new.email)
  on conflict (user_id) do nothing;

  insert into public.workspaces (owner_id, name)
  values (new.id, v_display_name || ' Studio')
  returning id into v_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, new.id, 'owner');

  insert into public.business_settings (workspace_id, business_name)
  values (v_workspace_id, v_display_name || ' Studio');

  insert into public.app_settings (workspace_id, setting_key, setting_value)
  values
    (v_workspace_id, 'appearance', '{"theme":"light"}'::jsonb),
    (v_workspace_id, 'notifications', '{"sound":true,"deadline_reminders":[7,3,1,0]}'::jsonb);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- Security helper functions
-- -----------------------------------------------------------------------------
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

create or replace function public.clear_demo_seed(p_seed_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id
  from public.demo_seed_batches
  where id = p_seed_id;

  if v_workspace_id is null then
    raise exception 'Demo seed batch not found';
  end if;

  -- auth.uid() is null for the service-role seeder, but authenticated browser
  -- callers still require an admin role.
  if auth.uid() is not null and not public.is_workspace_admin(v_workspace_id) then
    raise exception 'Not authorized';
  end if;

  delete from public.calendar_events where demo_seed_id = p_seed_id;
  delete from public.notifications where demo_seed_id = p_seed_id;
  delete from public.order_submissions where demo_seed_id = p_seed_id;
  -- Preserve a seeded form if it has since received a non-demo submission.
  update public.order_forms
  set demo_seed_id = null
  where demo_seed_id = p_seed_id
    and exists (
      select 1
      from public.order_submissions
      where order_form_id = public.order_forms.id
        and demo_seed_id is distinct from p_seed_id
    );
  delete from public.order_forms where demo_seed_id = p_seed_id;
  delete from public.invoices where demo_seed_id = p_seed_id;
  delete from public.projects where demo_seed_id = p_seed_id;
  delete from public.clients where demo_seed_id = p_seed_id;
  delete from public.project_types where demo_seed_id = p_seed_id;
  delete from public.demo_seed_batches where id = p_seed_id;
end;
$$;

revoke all on function public.clear_demo_seed(uuid) from public;
grant execute on function public.clear_demo_seed(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.user_profiles enable row level security;
alter table public.admin_login_identities enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.demo_seed_batches enable row level security;

drop policy if exists own_profile_read on public.user_profiles;
create policy own_profile_read on public.user_profiles for select to authenticated using (id = auth.uid());
drop policy if exists own_profile_update on public.user_profiles;
create policy own_profile_update on public.user_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists own_profile_insert on public.user_profiles;
create policy own_profile_insert on public.user_profiles for insert to authenticated with check (id = auth.uid());

-- There are deliberately no browser policies for admin_login_identities.
drop policy if exists workspace_member_read on public.workspaces;
create policy workspace_member_read on public.workspaces for select to authenticated using (public.is_workspace_member(id));
drop policy if exists workspace_owner_insert on public.workspaces;
create policy workspace_owner_insert on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists workspace_admin_update on public.workspaces;
create policy workspace_admin_update on public.workspaces for update to authenticated using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));
drop policy if exists workspace_owner_delete on public.workspaces;
create policy workspace_owner_delete on public.workspaces for delete to authenticated using (owner_id = auth.uid());

drop policy if exists workspace_members_read on public.workspace_members;
create policy workspace_members_read on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
drop policy if exists workspace_members_admin_write on public.workspace_members;
create policy workspace_members_admin_write on public.workspace_members for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

drop policy if exists demo_seed_batches_member_manage on public.demo_seed_batches;
create policy demo_seed_batches_member_manage on public.demo_seed_batches for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'clients', 'project_types', 'projects', 'project_tasks', 'project_task_notes', 'project_task_attachments', 'project_timeline',
    'project_public_access', 'order_forms', 'order_form_fields', 'order_submissions',
    'order_submission_files', 'invoices', 'invoice_items', 'payments', 'project_payment_records', 'service_catalogs', 'service_quotes', 'service_quote_items', 'notifications',
    'calendar_events', 'app_settings', 'business_settings'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('drop policy if exists workspace_member_manage on public.%I', v_table);
    execute format(
      'create policy workspace_member_manage on public.%I for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))',
      v_table
    );
  end loop;
end;
$$;

-- Keep SQL function access tight; public functions below get explicit grants.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- The server-side seed/admin client uses the Supabase service_role claim.
-- It bypasses RLS but still needs object privileges after the revokes above.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Narrow public access functions. These are the only anonymous database entrypoints.
-- -----------------------------------------------------------------------------
create or replace function public.get_public_project(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'project_name', p.name,
    'project_type', coalesce(pt.name, 'Project'),
    'client_name', case when ppa.show_client_name then c.name else null end,
    'current_status', replace(p.status::text, '_', ' '),
    'progress', p.progress_percentage,
    'start_date', p.start_date,
    'deadline', p.deadline,
    'days_remaining', case when p.deadline is null then null else (p.deadline - current_date) end,
    'description', p.client_visible_description,
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', tl.title,
        'description', tl.description,
        'occurred_at', tl.occurred_at,
        'status', case when tl.status_snapshot is null then null else replace(tl.status_snapshot::text, '_', ' ') end
      ) order by tl.occurred_at asc)
      from public.project_timeline tl
      where tl.project_id = p.id and tl.visibility = 'client'
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.name,
        'status', replace(t.status::text, '_', ' '),
        'due_at', t.due_at,
        'completed_at', t.completed_at
      ) order by t.due_at nulls last, t.created_at asc)
      from public.project_tasks t
      where t.project_id = p.id and t.client_visible = true
    ), '[]'::jsonb)
  ) into v_result
  from public.project_public_access ppa
  join public.projects p on p.id = ppa.project_id
  left join public.clients c on c.id = p.client_id
  left join public.project_types pt on pt.id = p.project_type_id
  where ppa.public_token = p_token
    and ppa.is_enabled = true
    and ppa.revoked_at is null;

  return v_result;
end;
$$;

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

create or replace function public.get_public_order_form(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
$$;

create or replace function public.submit_public_order(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.order_forms%rowtype;
  v_name text;
  v_company text;
  v_email text;
  v_whatsapp text;
  v_type text;
  v_deadline date;
  v_client_id uuid;
  v_project_type_id uuid;
  v_project_id uuid;
  v_submission_id uuid;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid submission payload';
  end if;

  select * into v_form
  from public.order_forms
  where public_token = p_token and is_active = true;

  if not found then
    raise exception 'This order form is unavailable';
  end if;

  v_name := nullif(trim(coalesce(p_payload ->> 'name', '')), '');
  v_company := nullif(trim(coalesce(p_payload ->> 'company', '')), '');
  v_email := nullif(lower(trim(coalesce(p_payload ->> 'email', ''))), '')::text;
  v_whatsapp := nullif(trim(coalesce(p_payload ->> 'whatsapp', '')), '');
  v_type := nullif(trim(coalesce(p_payload ->> 'project_type', '')), '');

  if v_name is null or char_length(v_name) < 2 then
    raise exception 'A valid name is required';
  end if;

  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid email is required';
  end if;

  begin
    v_deadline := nullif(p_payload ->> 'deadline_preference', '')::date;
  exception when invalid_datetime_format then
    v_deadline := null;
  end;

  if v_email is not null then
    select id into v_client_id
    from public.clients
    where workspace_id = v_form.workspace_id and lower(email::text) = lower(v_email::text)
    limit 1;
  end if;

  if v_client_id is null then
    select id into v_client_id
    from public.clients
    where workspace_id = v_form.workspace_id
      and lower(name) = lower(v_name)
      and coalesce(lower(company), '') = coalesce(lower(v_company), '')
    limit 1;
  end if;

  if v_client_id is null then
    insert into public.clients (workspace_id, name, company, whatsapp, email, status)
    values (v_form.workspace_id, v_name, v_company, v_whatsapp, v_email, 'lead')
    returning id into v_client_id;
  end if;

  if v_type is not null then
    select id into v_project_type_id
    from public.project_types
    where workspace_id = v_form.workspace_id and lower(name) = lower(v_type)
    limit 1;
  end if;

  insert into public.projects (
    workspace_id, client_id, project_type_id, code, name, description,
    status, priority, deadline, estimated_value, payment_status, progress_percentage
  ) values (
    v_form.workspace_id,
    v_client_id,
    v_project_type_id,
    public.generate_project_code(),
    coalesce(nullif(trim(p_payload ->> 'project_name'), ''), coalesce(v_type, 'New project') || ' request'),
    nullif(trim(p_payload ->> 'project_description'), ''),
    'inquiry',
    'medium',
    v_deadline,
    coalesce(nullif(regexp_replace(coalesce(p_payload ->> 'budget', ''), '[^0-9.]', '', 'g'), '')::numeric, 0),
    'unpaid',
    0
  ) returning id into v_project_id;

  insert into public.order_submissions (
    workspace_id, order_form_id, client_id, project_id, submitter_name,
    submitter_email, submitter_whatsapp, payload
  ) values (
    v_form.workspace_id, v_form.id, v_client_id, v_project_id, v_name,
    v_email, v_whatsapp, p_payload
  ) returning id into v_submission_id;

  return jsonb_build_object('accepted', true, 'message', v_form.confirmation_message);
end;
$$;

create or replace function public.regenerate_project_public_token(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_token text := public.generate_secure_token();
begin
  select workspace_id into v_workspace_id from public.projects where id = p_project_id;
  if v_workspace_id is null or not public.is_workspace_admin(v_workspace_id) then
    raise exception 'Not authorized';
  end if;

  insert into public.project_public_access (workspace_id, project_id, public_token, is_enabled, revoked_at)
  values (v_workspace_id, p_project_id, v_token, true, null)
  on conflict (project_id) do update
    set public_token = excluded.public_token,
        is_enabled = true,
        revoked_at = null,
        updated_at = timezone('utc', now());

  return v_token;
end;
$$;

revoke all on function public.get_public_project(text) from public;
revoke all on function public.get_public_project_by_code(text) from public;
revoke all on function public.get_public_project_by_slug(text) from public;
revoke all on function public.get_public_order_form(text) from public;
revoke all on function public.submit_public_order(text, jsonb) from public;
revoke all on function public.regenerate_project_public_token(uuid) from public;
revoke all on function public.record_project_payment(uuid, uuid, numeric, timestamptz, text, text) from public;
grant execute on function public.get_public_project(text) to anon, authenticated;
grant execute on function public.get_public_project_by_code(text) to anon, authenticated;
grant execute on function public.get_public_project_by_slug(text) to anon, authenticated;
grant execute on function public.get_public_order_form(text) to anon, authenticated;
grant execute on function public.submit_public_order(text, jsonb) to anon, authenticated;
grant execute on function public.regenerate_project_public_token(uuid) to authenticated;
grant execute on function public.record_project_payment(uuid, uuid, numeric, timestamptz, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: private order attachments. Upload via an Edge Function or signed URL;
-- never expose this bucket publicly.
-- -----------------------------------------------------------------------------
-- Re-declare the helper here so this storage section is safe to run on its own
-- from the SQL Editor as well as part of the full schema.
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
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$is_workspace_member$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $is_workspace_admin$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$is_workspace_admin$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nayagement-settings',
  'nayagement-settings',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists nayagement_settings_read on storage.objects;
create policy nayagement_settings_read on storage.objects for select to authenticated
using (bucket_id = 'nayagement-settings');
drop policy if exists nayagement_settings_insert on storage.objects;
create policy nayagement_settings_insert on storage.objects for insert to authenticated
with check (bucket_id = 'nayagement-settings' and (((storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text) or ((storage.foldername(name))[1] = 'workspaces' and public.is_workspace_admin(public.safe_uuid((storage.foldername(name))[2])))));
drop policy if exists nayagement_settings_update on storage.objects;
create policy nayagement_settings_update on storage.objects for update to authenticated
using (bucket_id = 'nayagement-settings' and (((storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text) or ((storage.foldername(name))[1] = 'workspaces' and public.is_workspace_admin(public.safe_uuid((storage.foldername(name))[2])))))
with check (bucket_id = 'nayagement-settings' and (((storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text) or ((storage.foldername(name))[1] = 'workspaces' and public.is_workspace_admin(public.safe_uuid((storage.foldername(name))[2])))));
drop policy if exists nayagement_settings_delete on storage.objects;
create policy nayagement_settings_delete on storage.objects for delete to authenticated
using (bucket_id = 'nayagement-settings' and (((storage.foldername(name))[1] = 'profiles' and (storage.foldername(name))[2] = auth.uid()::text) or ((storage.foldername(name))[1] = 'workspaces' and public.is_workspace_admin(public.safe_uuid((storage.foldername(name))[2])))));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-attachments',
  'order-attachments',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/zip']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists workspace_attachment_read on storage.objects;
create policy workspace_attachment_read on storage.objects for select to authenticated
using (
  bucket_id = 'order-attachments'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists workspace_attachment_insert on storage.objects;
create policy workspace_attachment_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'order-attachments'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists workspace_attachment_delete on storage.objects;
create policy workspace_attachment_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'order-attachments'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  15728640,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'application/zip', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists task_attachment_storage_read on storage.objects;
create policy task_attachment_storage_read on storage.objects for select to authenticated
using (
  bucket_id = 'task-attachments'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists task_attachment_storage_insert on storage.objects;
create policy task_attachment_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'task-attachments'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists task_attachment_storage_delete on storage.objects;
create policy task_attachment_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'task-attachments'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-logos',
  'client-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists client_logo_upload on storage.objects;
create policy client_logo_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-logos'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoice-logos',
  'invoice-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists invoice_logo_upload on storage.objects;
create policy invoice_logo_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'invoice-logos'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists invoice_logo_update on storage.objects;
create policy invoice_logo_update on storage.objects for update to authenticated
using (
  bucket_id = 'invoice-logos'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
)
with check (
  bucket_id = 'invoice-logos'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists invoice_logo_delete on storage.objects;
create policy invoice_logo_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'invoice-logos'
  and public.is_workspace_member(public.safe_uuid((storage.foldername(name))[1]))
);

-- -----------------------------------------------------------------------------
-- Realtime: only the event-oriented tables are published.
-- -----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.clients;
exception when duplicate_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.project_tasks;
exception when duplicate_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table public.order_submissions;
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Optional sample-data helper. Call from SQL Editor after creating an admin user:
-- select public.seed_demo_data('<workspace-uuid>');
-- -----------------------------------------------------------------------------
create or replace function public.seed_demo_data(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_aurora uuid;
  v_client_bilik uuid;
  v_type_branding uuid;
  v_type_social uuid;
  v_project_aurora uuid;
  v_project_bilik uuid;
begin
  if auth.uid() is not null and not public.is_workspace_admin(p_workspace_id) then
    raise exception 'Not authorized';
  end if;

  insert into public.project_types (workspace_id, name, color, is_default, sort_order)
  values
    (p_workspace_id, 'Branding', '#5B8EE6', true, 1),
    (p_workspace_id, 'Social Media', '#8A76D9', true, 2),
    (p_workspace_id, 'Spreadsheet Custom', '#54B997', true, 3),
    (p_workspace_id, 'Website', '#E09A6A', true, 4),
    (p_workspace_id, 'Presentation', '#D8789B', true, 5)
  on conflict (workspace_id, name) do nothing;

  select id into v_type_branding from public.project_types where workspace_id = p_workspace_id and name = 'Branding';
  select id into v_type_social from public.project_types where workspace_id = p_workspace_id and name = 'Social Media';

  select id into v_client_aurora from public.clients where workspace_id = p_workspace_id and company = 'Aurora Studio' limit 1;
  if v_client_aurora is null then
    insert into public.clients (workspace_id, name, company, status, email)
    values (p_workspace_id, 'Aurelia Ramadhan', 'Aurora Studio', 'active', 'aurelia@aurorastudio.example')
    returning id into v_client_aurora;
  end if;

  select id into v_client_bilik from public.clients where workspace_id = p_workspace_id and company = 'Bilik Strategi' limit 1;
  if v_client_bilik is null then
    insert into public.clients (workspace_id, name, company, status, email)
    values (p_workspace_id, 'Irfan Pratama', 'Bilik Strategi', 'returning', 'irfan@bilikstrategi.example')
    returning id into v_client_bilik;
  end if;

  select id into v_project_aurora from public.projects where workspace_id = p_workspace_id and name = 'Aurora Brand Refresh' limit 1;
  if v_project_aurora is null then
    insert into public.projects (
      workspace_id, client_id, project_type_id, code, name, description,
      client_visible_description, status, priority, start_date, deadline,
      estimated_value, paid_amount, payment_status, progress_percentage, client_visibility
    ) values (
      p_workspace_id, v_client_aurora, v_type_branding, public.generate_project_code(),
      'Aurora Brand Refresh', 'Visual identity dan guideline untuk relaunch Aurora Studio.',
      'Kami sedang menyempurnakan sistem visual dan aplikasi brand.', 'in_progress', 'high',
      current_date - 18, current_date + 3, 12800000, 6400000, 'partial', 72, true
    ) returning id into v_project_aurora;
  end if;

  select id into v_project_bilik from public.projects where workspace_id = p_workspace_id and name = 'Monthly Social Sprint' limit 1;
  if v_project_bilik is null then
    insert into public.projects (
      workspace_id, client_id, project_type_id, code, name, description,
      status, priority, start_date, deadline, estimated_value, paid_amount, payment_status, progress_percentage
    ) values (
      p_workspace_id, v_client_bilik, v_type_social, public.generate_project_code(),
      'Monthly Social Sprint', 'Konten dan kalender publikasi Agustus.',
      'review', 'urgent', current_date - 21, current_date + 1, 7500000, 7500000, 'paid', 88
    ) returning id into v_project_bilik;
  end if;

  if not exists (select 1 from public.project_tasks where project_id = v_project_aurora and name = 'Kirim brand direction v2') then
    insert into public.project_tasks (workspace_id, project_id, name, status, priority, due_at, client_visible)
    values (p_workspace_id, v_project_aurora, 'Kirim brand direction v2', 'in_progress', 'high', timezone('utc', now()) + interval '4 hours', true);
  end if;

  if not exists (select 1 from public.project_tasks where project_id = v_project_bilik and name = 'Review caption carousel') then
    insert into public.project_tasks (workspace_id, project_id, name, status, priority, due_at, client_visible)
    values (p_workspace_id, v_project_bilik, 'Review caption carousel', 'review', 'urgent', timezone('utc', now()) + interval '1 day', true);
  end if;

  if not exists (select 1 from public.project_timeline where project_id = v_project_aurora and title = 'Brief disepakati') then
    insert into public.project_timeline (workspace_id, project_id, title, description, occurred_at, status_snapshot, visibility)
    values
      (p_workspace_id, v_project_aurora, 'Brief disepakati', 'Arah proyek dan ruang lingkup telah dikonfirmasi bersama.', timezone('utc', now()) - interval '18 days', 'confirmed', 'client'),
      (p_workspace_id, v_project_aurora, 'Eksplorasi visual selesai', 'Tiga arah visual disiapkan untuk dipilih.', timezone('utc', now()) - interval '10 days', 'in_progress', 'client'),
      (p_workspace_id, v_project_aurora, 'Penyempurnaan identitas', 'Menyiapkan sistem warna dan aplikasi brand.', timezone('utc', now()), 'in_progress', 'client');
  end if;

  insert into public.project_public_access (workspace_id, project_id, is_enabled, show_client_name)
  values (p_workspace_id, v_project_aurora, true, true)
  on conflict (project_id) do nothing;
end;
$$;

revoke all on function public.seed_demo_data(uuid) from public;
grant execute on function public.seed_demo_data(uuid) to authenticated;
