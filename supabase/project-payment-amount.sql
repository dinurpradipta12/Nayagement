-- Nayagement: custom project payment amount
-- Run this file once in the Supabase SQL Editor for an existing database.

begin;

alter table public.projects
  add column if not exists paid_amount numeric(14,2);

update public.projects
set paid_amount = case
  when payment_status = 'paid' then coalesce(estimated_value, final_value, 0)
  when payment_status = 'partial' then round(coalesce(estimated_value, final_value, 0) / 2)
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

commit;
