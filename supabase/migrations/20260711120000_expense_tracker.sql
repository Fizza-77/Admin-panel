-- Expense tracker: permission flag + expense records.
--
-- SAFE FOR EXISTING RLS:
--   • Does NOT alter existing table policies.
--   • Only adds can_manage_expenses to app_profiles and creates expenses.
--   • Admin API uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS); expenses is server-only.
--
-- Deploy: run this migration, then deploy app code that calls svc_upsert_app_profile (9-arg version).

-- ─── Permission column ───
alter table public.app_profiles
  add column if not exists can_manage_expenses boolean not null default false;

comment on column public.app_profiles.can_manage_expenses is
  'When true, user may view and manage team expenses via /expenses.';

-- ─── Expense records ───
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text,
  notes text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_date_idx
  on public.expenses (expense_date desc);

create index if not exists expenses_created_by_idx
  on public.expenses (created_by);

comment on table public.expenses is
  'Team expense records. Server-only (service_role); not exposed to anon/authenticated clients.';

alter table public.expenses enable row level security;

drop policy if exists "service_role_all_expenses" on public.expenses;
create policy "service_role_all_expenses"
  on public.expenses
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "expenses_deny_client_roles" on public.expenses;
create policy "expenses_deny_client_roles"
  on public.expenses
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.expenses to service_role;

-- ─── Profile RPCs: add can_manage_expenses ───

create or replace function public.svc_get_app_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'can_manage_blogs', coalesce(can_manage_blogs, false),
    'can_manage_tasks', coalesce(can_manage_tasks, false),
    'can_administer_tasks', coalesce(can_administer_tasks, false),
    'can_manage_users', coalesce(can_manage_users, false),
    'can_manage_attendance', coalesce(can_manage_attendance, false),
    'can_manage_expenses', coalesce(can_manage_expenses, false),
    'display_name', display_name,
    'avatar_url', avatar_url
  )
  into result
  from public.app_profiles
  where user_id = p_user_id;

  return result;
exception
  when undefined_column then
    select jsonb_build_object(
      'can_manage_blogs', coalesce(can_manage_blogs, false),
      'can_manage_tasks', coalesce(can_manage_tasks, false),
      'can_administer_tasks', coalesce(can_administer_tasks, false),
      'can_manage_users', coalesce(can_manage_users, false),
      'can_manage_attendance', coalesce(can_manage_attendance, false),
      'can_manage_expenses', false,
      'display_name', display_name,
      'avatar_url', avatar_url
    )
    into result
    from public.app_profiles
    where user_id = p_user_id;
    return result;
end;
$$;

create or replace function public.svc_upsert_default_app_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_profiles (
    user_id,
    can_manage_blogs,
    can_manage_tasks,
    can_administer_tasks,
    can_manage_users,
    can_manage_attendance,
    can_manage_expenses,
    updated_at
  )
  values (p_user_id, false, true, false, false, false, false, now())
  on conflict (user_id) do update
    set updated_at = excluded.updated_at;
exception
  when undefined_column then
    insert into public.app_profiles (
      user_id,
      can_manage_blogs,
      can_manage_tasks,
      can_administer_tasks,
      can_manage_users,
      can_manage_attendance,
      updated_at
    )
    values (p_user_id, false, true, false, false, false, now())
    on conflict (user_id) do update
      set updated_at = excluded.updated_at;
end;
$$;

create or replace function public.svc_upsert_full_access_app_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_profiles (
    user_id,
    can_manage_blogs,
    can_manage_tasks,
    can_administer_tasks,
    can_manage_users,
    can_manage_attendance,
    can_manage_expenses,
    updated_at
  )
  values (p_user_id, true, true, true, true, true, true, now())
  on conflict (user_id) do update
    set
      can_manage_blogs = true,
      can_manage_tasks = true,
      can_administer_tasks = true,
      can_manage_users = true,
      can_manage_attendance = true,
      can_manage_expenses = true,
      updated_at = now();
exception
  when undefined_column then
    insert into public.app_profiles (
      user_id,
      can_manage_blogs,
      can_manage_tasks,
      can_administer_tasks,
      can_manage_users,
      can_manage_attendance,
      updated_at
    )
    values (p_user_id, true, true, true, true, true, now())
    on conflict (user_id) do update
      set
        can_manage_blogs = true,
        can_manage_tasks = true,
        can_administer_tasks = true,
        can_manage_users = true,
        can_manage_attendance = true,
        updated_at = now();
end;
$$;

drop function if exists public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, boolean, text, text);

create or replace function public.svc_upsert_app_profile(
  p_user_id uuid,
  p_can_manage_blogs boolean,
  p_can_manage_tasks boolean,
  p_can_administer_tasks boolean,
  p_can_manage_users boolean,
  p_can_manage_attendance boolean,
  p_can_manage_expenses boolean,
  p_display_name text,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_profiles (
    user_id,
    can_manage_blogs,
    can_manage_tasks,
    can_administer_tasks,
    can_manage_users,
    can_manage_attendance,
    can_manage_expenses,
    display_name,
    avatar_url,
    updated_at
  )
  values (
    p_user_id,
    coalesce(p_can_manage_blogs, false),
    coalesce(p_can_manage_tasks, true),
    coalesce(p_can_administer_tasks, false),
    coalesce(p_can_manage_users, false),
    coalesce(p_can_manage_attendance, false),
    coalesce(p_can_manage_expenses, false),
    nullif(trim(p_display_name), ''),
    nullif(trim(p_avatar_url), ''),
    now()
  )
  on conflict (user_id) do update
    set
      can_manage_blogs = excluded.can_manage_blogs,
      can_manage_tasks = excluded.can_manage_tasks,
      can_administer_tasks = excluded.can_administer_tasks,
      can_manage_users = excluded.can_manage_users,
      can_manage_attendance = excluded.can_manage_attendance,
      can_manage_expenses = excluded.can_manage_expenses,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = now();
exception
  when undefined_column then
    insert into public.app_profiles (
      user_id,
      can_manage_blogs,
      can_manage_tasks,
      can_administer_tasks,
      can_manage_users,
      can_manage_attendance,
      display_name,
      avatar_url,
      updated_at
    )
    values (
      p_user_id,
      coalesce(p_can_manage_blogs, false),
      coalesce(p_can_manage_tasks, true),
      coalesce(p_can_administer_tasks, false),
      coalesce(p_can_manage_users, false),
      coalesce(p_can_manage_attendance, false),
      nullif(trim(p_display_name), ''),
      nullif(trim(p_avatar_url), ''),
      now()
    )
    on conflict (user_id) do update
      set
        can_manage_blogs = excluded.can_manage_blogs,
        can_manage_tasks = excluded.can_manage_tasks,
        can_administer_tasks = excluded.can_administer_tasks,
        can_manage_users = excluded.can_manage_users,
        can_manage_attendance = excluded.can_manage_attendance,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();
end;
$$;

revoke all on function public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, boolean, boolean, text, text) from public;
grant execute on function public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, boolean, boolean, text, text) to service_role;
