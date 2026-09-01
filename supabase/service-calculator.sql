-- Nayagement: Kalkulator jasa & penawaran
-- Jalankan seluruh file ini sekali di Supabase SQL Editor, lalu muat ulang aplikasi.

begin;

-- Helper ini dibuat ulang agar policy di bawah tetap dapat dijalankan mandiri.
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $is_workspace_member$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
$is_workspace_member$;

revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $set_updated_at$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$set_updated_at$;

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

-- Menangani database yang mungkin sudah memiliki tabel hasil percobaan sebelumnya.
alter table public.service_catalogs
  add column if not exists description text,
  add column if not exists pricing_mode text not null default 'package',
  add column if not exists minimum_fee numeric(14,2) not null default 0,
  add column if not exists default_unit_label text not null default 'paket',
  add column if not exists default_unit_price numeric(14,2) not null default 0,
  add column if not exists default_quantity numeric(10,2) not null default 1,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.service_quotes
  add column if not exists converted_invoice_id uuid references public.invoices(id) on delete set null,
  add column if not exists title text not null default 'Penawaran layanan',
  add column if not exists status text not null default 'draft',
  add column if not exists currency text not null default 'IDR',
  add column if not exists issue_date date not null default current_date,
  add column if not exists valid_until date,
  add column if not exists subtotal numeric(14,2) not null default 0,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists tax_rate numeric(5,2) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists total_amount numeric(14,2) not null default 0,
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.service_quote_items
  add column if not exists catalog_id uuid references public.service_catalogs(id) on delete set null,
  add column if not exists detail text,
  add column if not exists pricing_mode text not null default 'package',
  add column if not exists quantity numeric(10,2) not null default 1,
  add column if not exists unit_label text not null default 'paket',
  add column if not exists unit_price numeric(14,2) not null default 0,
  add column if not exists minimum_fee numeric(14,2) not null default 0,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists service_catalogs_workspace_active_idx on public.service_catalogs (workspace_id, is_active, updated_at desc);
create index if not exists service_quotes_workspace_updated_idx on public.service_quotes (workspace_id, updated_at desc);
create index if not exists service_quotes_workspace_status_idx on public.service_quotes (workspace_id, status, issue_date desc);
create index if not exists service_quote_items_quote_sort_idx on public.service_quote_items (quote_id, sort_order);

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

  if v_discount is null and v_tax_rate is null then
    return;
  end if;

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

drop trigger if exists service_catalogs_set_updated_at on public.service_catalogs;
create trigger service_catalogs_set_updated_at before update on public.service_catalogs for each row execute function public.set_updated_at();

drop trigger if exists service_quotes_set_updated_at on public.service_quotes;
create trigger service_quotes_set_updated_at before update on public.service_quotes for each row execute function public.set_updated_at();

drop trigger if exists service_quote_items_set_updated_at on public.service_quote_items;
create trigger service_quote_items_set_updated_at before update on public.service_quote_items for each row execute function public.set_updated_at();

drop trigger if exists service_quote_items_refresh_totals on public.service_quote_items;
create trigger service_quote_items_refresh_totals after insert or update or delete on public.service_quote_items for each row execute function public.refresh_service_quote_totals_from_item();

alter table public.service_catalogs enable row level security;
alter table public.service_quotes enable row level security;
alter table public.service_quote_items enable row level security;

drop policy if exists workspace_member_manage on public.service_catalogs;
create policy workspace_member_manage on public.service_catalogs
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists workspace_member_manage on public.service_quotes;
create policy workspace_member_manage on public.service_quotes
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists workspace_member_manage on public.service_quote_items;
create policy workspace_member_manage on public.service_quote_items
for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.service_catalogs to authenticated;
grant select, insert, update, delete on public.service_quotes to authenticated;
grant select, insert, update, delete on public.service_quote_items to authenticated;

commit;

notify pgrst, 'reload schema';
