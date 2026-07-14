-- Per-month opt-out for payroll expenses: delete one month without clearing employee salary.

create table if not exists public.expense_payroll_month_exclusions (
  user_id uuid not null references auth.users (id) on delete cascade,
  expense_month date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, expense_month)
);

create index if not exists expense_payroll_month_exclusions_month_idx
  on public.expense_payroll_month_exclusions (expense_month);

comment on table public.expense_payroll_month_exclusions is
  'Months where an employee salary should not appear as a Payroll expense after being deleted for that month only. Does not change profile salary.';
