-- Nayagement: modul Keuangan Pribadi, Budget Keluarga, dan Target Tabungan.
-- Jalankan seluruh file ini di Supabase SQL Editor. Aman dijalankan ulang.

create table if not exists public.personal_finance_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  kind text not null check (kind in ('income', 'expense')),
  color text not null default '#2f6fdf' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name, kind)
);

create table if not exists public.personal_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid references public.personal_finance_categories(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 160),
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  occurred_on date not null default current_date,
  payment_method text,
  notes text,
  scope text not null default 'personal' check (scope in ('personal', 'family')),
  family_member text,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_finance_budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid not null references public.personal_finance_categories(id) on delete cascade,
  budget_month date not null check (budget_month = date_trunc('month', budget_month)::date),
  kind text not null check (kind in ('income', 'expense')),
  planned_amount numeric(14,2) not null check (planned_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, category_id, budget_month)
);

create table if not exists public.personal_savings_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  target_date date,
  color text not null default '#2f6fdf' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_finance_transactions_workspace_date_idx
  on public.personal_finance_transactions(workspace_id, occurred_on desc);
create index if not exists personal_finance_budgets_workspace_month_idx
  on public.personal_finance_budgets(workspace_id, budget_month);
create index if not exists personal_savings_goals_workspace_idx
  on public.personal_savings_goals(workspace_id);

alter table public.personal_finance_categories enable row level security;
alter table public.personal_finance_transactions enable row level security;
alter table public.personal_finance_budgets enable row level security;
alter table public.personal_savings_goals enable row level security;

drop policy if exists personal_finance_categories_member_manage on public.personal_finance_categories;
create policy personal_finance_categories_member_manage
on public.personal_finance_categories for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists personal_finance_transactions_member_manage on public.personal_finance_transactions;
create policy personal_finance_transactions_member_manage
on public.personal_finance_transactions for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists personal_finance_budgets_member_manage on public.personal_finance_budgets;
create policy personal_finance_budgets_member_manage
on public.personal_finance_budgets for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists personal_savings_goals_member_manage on public.personal_savings_goals;
create policy personal_savings_goals_member_manage
on public.personal_savings_goals for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

grant select, insert, update, delete on public.personal_finance_categories to authenticated;
grant select, insert, update, delete on public.personal_finance_transactions to authenticated;
grant select, insert, update, delete on public.personal_finance_budgets to authenticated;
grant select, insert, update, delete on public.personal_savings_goals to authenticated;

create or replace function public.personal_finance_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $personal_finance_set_updated_at$
begin
  new.updated_at = now();
  return new;
end;
$personal_finance_set_updated_at$;

drop trigger if exists personal_finance_categories_updated_at on public.personal_finance_categories;
create trigger personal_finance_categories_updated_at
before update on public.personal_finance_categories
for each row execute function public.personal_finance_set_updated_at();

drop trigger if exists personal_finance_transactions_updated_at on public.personal_finance_transactions;
create trigger personal_finance_transactions_updated_at
before update on public.personal_finance_transactions
for each row execute function public.personal_finance_set_updated_at();

drop trigger if exists personal_finance_budgets_updated_at on public.personal_finance_budgets;
create trigger personal_finance_budgets_updated_at
before update on public.personal_finance_budgets
for each row execute function public.personal_finance_set_updated_at();

drop trigger if exists personal_savings_goals_updated_at on public.personal_savings_goals;
create trigger personal_savings_goals_updated_at
before update on public.personal_savings_goals
for each row execute function public.personal_finance_set_updated_at();

do $personal_finance_realtime$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'personal_finance_transactions'
  ) then
    alter publication supabase_realtime add table public.personal_finance_transactions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'personal_finance_budgets'
  ) then
    alter publication supabase_realtime add table public.personal_finance_budgets;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'personal_savings_goals'
  ) then
    alter publication supabase_realtime add table public.personal_savings_goals;
  end if;
end;
$personal_finance_realtime$;

notify pgrst, 'reload schema';

select 'personal_finance_ready' as status;
