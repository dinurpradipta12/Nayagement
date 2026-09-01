-- Nayagement: riwayat pembayaran proyek untuk dashboard Finance
-- Jalankan sekali di Supabase SQL Editor. Aman dijalankan ulang.

begin;

-- Pastikan total pembayaran proyek tersedia, termasuk untuk instalasi lama.
alter table public.projects
  add column if not exists paid_amount numeric(14,2);

update public.projects
set paid_amount = case
  when payment_status = 'paid' then coalesce(estimated_value, 0)
  when payment_status = 'partial' then round(coalesce(estimated_value, 0) / 2)
  else 0
end
where paid_amount is null;

alter table public.projects
  alter column paid_amount set default 0;

alter table public.projects
  alter column paid_amount set not null;

alter table public.projects
  drop constraint if exists projects_paid_amount_nonnegative;

alter table public.projects
  add constraint projects_paid_amount_nonnegative
  check (paid_amount >= 0);

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

create index if not exists project_payment_records_workspace_paid_at_idx
  on public.project_payment_records (workspace_id, paid_at desc);

create index if not exists project_payment_records_project_paid_at_idx
  on public.project_payment_records (project_id, paid_at desc);

alter table public.project_payment_records enable row level security;

drop policy if exists workspace_member_manage on public.project_payment_records;
create policy workspace_member_manage
on public.project_payment_records
for all
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

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

  if v_amount <= 0 then
    raise exception 'Nominal pembayaran tidak dapat dicatat';
  end if;

  v_paid_at := coalesce(p_paid_at, timezone('utc', now()));
  v_next := v_current + v_amount;

  insert into public.project_payment_records (
    workspace_id, project_id, amount, paid_at, method, notes
  ) values (
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

revoke all on function public.record_project_payment(uuid, uuid, numeric, timestamptz, text, text) from public;
grant execute on function public.record_project_payment(uuid, uuid, numeric, timestamptz, text, text) to authenticated;

do $realtime$
begin
  alter publication supabase_realtime add table public.project_payment_records;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$realtime$;

commit;

notify pgrst, 'reload schema';
