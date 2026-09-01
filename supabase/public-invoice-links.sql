-- Nayagement: tautan publik invoice tanpa login.
-- Jalankan seluruh file ini di Supabase SQL Editor.
-- Aman dijalankan ulang.

create table if not exists public.invoice_public_access (
  invoice_id uuid primary key references public.invoices(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  public_code text not null unique,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_public_access_code_format check (public_code ~ '^[a-f0-9]{16}$')
);

create index if not exists invoice_public_access_workspace_idx
  on public.invoice_public_access(workspace_id);

alter table public.invoice_public_access enable row level security;

drop policy if exists invoice_public_access_member_manage on public.invoice_public_access;
create policy invoice_public_access_member_manage
on public.invoice_public_access
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

revoke all on table public.invoice_public_access from anon;
grant select, insert, update, delete on table public.invoice_public_access to authenticated;
grant all on table public.invoice_public_access to service_role;

create or replace function public.allocate_invoice_public_code()
returns text
language plpgsql
set search_path = public, pg_temp
as $allocate_invoice_public_code$
declare
  candidate text;
begin
  loop
    candidate := substr(md5(random()::text || clock_timestamp()::text), 1, 16);
    exit when not exists (
      select 1
      from public.invoice_public_access access
      where access.public_code = candidate
    );
  end loop;
  return candidate;
end;
$allocate_invoice_public_code$;

revoke all on function public.allocate_invoice_public_code() from public;
grant execute on function public.allocate_invoice_public_code() to authenticated, service_role;

create or replace function public.ensure_invoice_public_access()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $ensure_invoice_public_access$
begin
  insert into public.invoice_public_access (
    invoice_id,
    workspace_id,
    public_code,
    is_enabled
  ) values (
    new.id,
    new.workspace_id,
    public.allocate_invoice_public_code(),
    true
  )
  on conflict (invoice_id) do update
  set workspace_id = excluded.workspace_id,
      updated_at = now();
  return new;
end;
$ensure_invoice_public_access$;

revoke all on function public.ensure_invoice_public_access() from public;

drop trigger if exists invoices_ensure_public_access on public.invoices;
create trigger invoices_ensure_public_access
after insert or update of workspace_id on public.invoices
for each row execute function public.ensure_invoice_public_access();

insert into public.invoice_public_access (
  invoice_id,
  workspace_id,
  public_code,
  is_enabled
)
select
  invoice.id,
  invoice.workspace_id,
  public.allocate_invoice_public_code(),
  true
from public.invoices invoice
where not exists (
  select 1
  from public.invoice_public_access access
  where access.invoice_id = invoice.id
)
on conflict (invoice_id) do nothing;

create or replace function public.get_public_invoice(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $get_public_invoice$
  select jsonb_build_object(
    'id', invoice.id,
    'invoice_number', invoice.invoice_number,
    'issue_date', invoice.issue_date,
    'due_date', invoice.due_date,
    'status', invoice.status,
    'currency', invoice.currency,
    'discount_amount', invoice.discount_amount,
    'tax_rate', invoice.tax_rate,
    'document_title', invoice.document_title,
    'brand_color', invoice.brand_color,
    'logo_path', invoice.logo_path,
    'signature_path', invoice.signature_path,
    'recipient_name', invoice.recipient_name,
    'recipient_company', invoice.recipient_company,
    'recipient_email', invoice.recipient_email,
    'recipient_whatsapp', invoice.recipient_whatsapp,
    'sender_name', invoice.sender_name,
    'sender_email', invoice.sender_email,
    'sender_phone', invoice.sender_phone,
    'sender_address', invoice.sender_address,
    'payment_instructions', invoice.payment_instructions,
    'notes', invoice.notes,
    'terms', invoice.terms,
    'footer_note', invoice.footer_note,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'description', item.description,
          'detail', item.detail,
          'quantity', item.quantity,
          'unit_price', item.unit_price
        ) order by item.sort_order, item.created_at, item.id
      )
      from public.invoice_items item
      where item.invoice_id = invoice.id
    ), '[]'::jsonb)
  )
  from public.invoice_public_access access
  join public.invoices invoice on invoice.id = access.invoice_id
  where access.public_code = lower(trim(p_code))
    and access.is_enabled = true
  limit 1;
$get_public_invoice$;

revoke all on function public.get_public_invoice(text) from public;
grant execute on function public.get_public_invoice(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- Verifikasi: setiap invoice harus memiliki public_code unik.
select
  invoice.invoice_number,
  access.public_code,
  access.is_enabled
from public.invoices invoice
join public.invoice_public_access access on access.invoice_id = invoice.id
order by invoice.created_at desc;
