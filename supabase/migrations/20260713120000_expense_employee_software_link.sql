-- Link monthly expenses to employees and recurring software subscriptions.

alter table public.expenses
  add column if not exists assigned_user_id uuid references auth.users (id) on delete set null,
  add column if not exists employee_software_id uuid references public.employee_software (id) on delete cascade;

create index if not exists expenses_assigned_user_idx
  on public.expenses (assigned_user_id);

create index if not exists expenses_employee_software_idx
  on public.expenses (employee_software_id);

create unique index if not exists expenses_software_month_uidx
  on public.expenses (employee_software_id, expense_date)
  where employee_software_id is not null;

comment on column public.expenses.assigned_user_id is
  'Employee this expense applies to (Software, Payroll, Equipment, Marketing).';

comment on column public.expenses.employee_software_id is
  'When set, this expense row is synced from employee_software for that month.';
