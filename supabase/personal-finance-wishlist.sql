-- Nayagement: Wishlist Keuangan Pribadi.
-- Jalankan setelah personal-finance.sql di Supabase SQL Editor.
-- Aman dijalankan ulang.

create table if not exists public.personal_finance_wishlist (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid references public.personal_finance_categories(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  estimated_amount numeric(14,2) not null check (estimated_amount > 0),
  actual_amount numeric(14,2) check (actual_amount is null or actual_amount > 0),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  target_date date,
  purchased_at date,
  notes text,
  status text not null default 'planned' check (status in ('planned', 'purchased')),
  transaction_id uuid unique references public.personal_finance_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_finance_wishlist_purchase_state check (
    (status = 'planned' and purchased_at is null)
    or
    (status = 'purchased' and purchased_at is not null and actual_amount is not null)
  )
);

create index if not exists personal_finance_wishlist_workspace_status_idx
  on public.personal_finance_wishlist(workspace_id, status, target_date);

alter table public.personal_finance_wishlist enable row level security;

drop policy if exists personal_finance_wishlist_member_manage
  on public.personal_finance_wishlist;

create policy personal_finance_wishlist_member_manage
on public.personal_finance_wishlist
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

grant select, insert, update, delete
on public.personal_finance_wishlist
to authenticated;

drop trigger if exists personal_finance_wishlist_updated_at
  on public.personal_finance_wishlist;

create trigger personal_finance_wishlist_updated_at
before update
on public.personal_finance_wishlist
for each row
execute function public.personal_finance_set_updated_at();

create or replace function public.purchase_personal_wishlist(
  p_workspace_id uuid,
  p_item_id uuid,
  p_amount numeric,
  p_purchased_on date,
  p_payment_method text default 'Transfer bank'
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $purchase_personal_wishlist$
declare
  wishlist_item public.personal_finance_wishlist%rowtype;
  created_transaction_id uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'Workspace tidak dapat diakses.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal pembelian harus lebih dari nol.';
  end if;

  if p_purchased_on is null then
    raise exception 'Tanggal pembelian wajib diisi.';
  end if;

  select *
  into wishlist_item
  from public.personal_finance_wishlist
  where id = p_item_id
    and workspace_id = p_workspace_id
  for update;

  if wishlist_item.id is null then
    raise exception 'Item wishlist tidak ditemukan.';
  end if;

  if wishlist_item.status = 'purchased' then
    return wishlist_item.transaction_id;
  end if;

  insert into public.personal_finance_transactions (
    workspace_id,
    category_id,
    title,
    kind,
    amount,
    occurred_on,
    payment_method,
    notes,
    scope,
    is_recurring
  ) values (
    p_workspace_id,
    wishlist_item.category_id,
    'Pembelian: ' || wishlist_item.name,
    'expense',
    p_amount,
    p_purchased_on,
    nullif(trim(coalesce(p_payment_method, '')), ''),
    nullif(trim(coalesce(wishlist_item.notes, '')), ''),
    'personal',
    false
  )
  returning id into created_transaction_id;

  update public.personal_finance_wishlist
  set status = 'purchased',
      actual_amount = p_amount,
      purchased_at = p_purchased_on,
      transaction_id = created_transaction_id,
      updated_at = now()
  where id = wishlist_item.id;

  return created_transaction_id;
end;
$purchase_personal_wishlist$;

revoke all on function public.purchase_personal_wishlist(uuid, uuid, numeric, date, text)
from public;

grant execute on function public.purchase_personal_wishlist(uuid, uuid, numeric, date, text)
to authenticated;

do $wishlist_realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'personal_finance_wishlist'
  ) then
    alter publication supabase_realtime
      add table public.personal_finance_wishlist;
  end if;
end;
$wishlist_realtime$;

notify pgrst, 'reload schema';

select 'personal_finance_wishlist_ready' as status;
