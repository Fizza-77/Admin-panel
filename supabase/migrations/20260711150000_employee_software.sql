-- Per-employee software subscriptions (recurring tools/licenses).

create table if not exists public.employee_software (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  software_name text not null,
  monthly_amount numeric(12, 2) check (monthly_amount is null or monthly_amount >= 0),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly', 'one_time')),
  notes text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, software_name)
);

create index if not exists employee_software_user_idx on public.employee_software (user_id);
create index if not exists employee_software_active_idx on public.employee_software (is_active) where is_active = true;

comment on table public.employee_software is
  'Software/tools assigned to each employee for expense tracking. Server-only (service_role).';

alter table public.employee_software enable row level security;

drop policy if exists "service_role_all_employee_software" on public.employee_software;
create policy "service_role_all_employee_software"
  on public.employee_software
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "employee_software_deny_client_roles" on public.employee_software;
create policy "employee_software_deny_client_roles"
  on public.employee_software
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.employee_software to service_role;
