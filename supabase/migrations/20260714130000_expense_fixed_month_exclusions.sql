-- Per-month opt-out for fixed expenses: deleting in one month keeps other months.

create table if not exists public.expense_fixed_month_exclusions (
  fixed_expense_id uuid not null references public.expenses (id) on delete cascade,
  expense_month date not null,
  created_at timestamptz not null default now(),
  primary key (fixed_expense_id, expense_month)
);

create index if not exists expense_fixed_month_exclusions_month_idx
  on public.expense_fixed_month_exclusions (expense_month);

comment on table public.expense_fixed_month_exclusions is
  'Months where a fixed expense template should not appear after being deleted for that month only.';
