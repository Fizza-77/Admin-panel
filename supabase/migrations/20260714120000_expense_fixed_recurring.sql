-- Fixed monthly expenses: template row + generated copies per month.

alter table public.expenses
  add column if not exists is_fixed boolean not null default false,
  add column if not exists fixed_expense_id uuid references public.expenses (id) on delete cascade;

create index if not exists expenses_is_fixed_idx
  on public.expenses (is_fixed)
  where is_fixed = true;

create index if not exists expenses_fixed_expense_id_idx
  on public.expenses (fixed_expense_id);

create unique index if not exists expenses_fixed_month_uidx
  on public.expenses (fixed_expense_id, expense_date)
  where fixed_expense_id is not null;

comment on column public.expenses.is_fixed is
  'When true, this row is a recurring template copied into each month''s expense list.';

comment on column public.expenses.fixed_expense_id is
  'When set, this row is a monthly copy of the fixed expense template.';
