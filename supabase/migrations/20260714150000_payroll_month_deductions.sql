-- Per-month salary deductions for payroll (profile salary stays the base amount).

create table if not exists public.payroll_month_deductions (
  user_id uuid not null references auth.users (id) on delete cascade,
  pay_month date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, pay_month)
);

create index if not exists payroll_month_deductions_month_idx
  on public.payroll_month_deductions (pay_month);

comment on table public.payroll_month_deductions is
  'Optional salary deduction for one employee in one pay month. Net pay = profile salary - amount. Other months keep full salary.';
