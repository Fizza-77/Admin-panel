-- Per-month salary bonuses for payroll (profile salary stays the base amount).
--
-- SAFE FOR EXISTING RLS: new table only; admin uses service_role.
-- Net pay = profile salary - deduction + bonus.

create table if not exists public.payroll_month_bonuses (
  user_id uuid not null references auth.users (id) on delete cascade,
  pay_month date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, pay_month)
);

create index if not exists payroll_month_bonuses_month_idx
  on public.payroll_month_bonuses (pay_month);

comment on table public.payroll_month_bonuses is
  'Optional salary bonus for one employee in one pay month. Net pay = profile salary - deduction + amount. Other months keep base salary.';

alter table public.payroll_month_bonuses enable row level security;

drop policy if exists "service_role_all_payroll_month_bonuses" on public.payroll_month_bonuses;
create policy "service_role_all_payroll_month_bonuses"
  on public.payroll_month_bonuses
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "payroll_month_bonuses_deny_client_roles" on public.payroll_month_bonuses;
create policy "payroll_month_bonuses_deny_client_roles"
  on public.payroll_month_bonuses
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.payroll_month_bonuses to service_role;
