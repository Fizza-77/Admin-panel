-- Attendance: permission flag + daily records.
--
-- SAFE FOR EXISTING RLS:
--   • Does NOT alter blogs, sites, blog_categories, blog_reactions, tasks, or app_profiles policies.
--   • Does NOT enable/disable RLS on any existing table.
--   • Only adds can_manage_attendance to app_profiles (column add) and creates attendance_records.
--   • Admin API uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS); attendance_records is server-only.
--
-- Deploy: run this migration, then deploy app code that calls svc_upsert_app_profile (7-arg version).

-- ─── Permission column (no RLS change on app_profiles) ───
alter table public.app_profiles
  add column if not exists can_manage_attendance boolean not null default false;

comment on column public.app_profiles.can_manage_attendance is
  'When true, user may mark daily attendance for all team members via /attendance.';

-- ─── Attendance records (new table only) ───
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'leave')),
  notes text,
  marked_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, attendance_date)
);

create index if not exists attendance_records_date_idx
  on public.attendance_records (attendance_date desc);

create index if not exists attendance_records_user_date_idx
  on public.attendance_records (user_id, attendance_date desc);

comment on table public.attendance_records is
  'Daily attendance marks. Server-only (service_role); not exposed to anon/authenticated clients.';

alter table public.attendance_records enable row level security;

-- Belt-and-suspenders for service_role (same pattern as blogs/sites admin writes).
drop policy if exists "service_role_all_attendance_records" on public.attendance_records;
create policy "service_role_all_attendance_records"
  on public.attendance_records
  for all
  to service_role
  using (true)
  with check (true);

-- Explicit deny for browser-facing roles (matches app_profiles server-only pattern).
drop policy if exists "attendance_records_deny_client_roles" on public.attendance_records;
create policy "attendance_records_deny_client_roles"
  on public.attendance_records
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.attendance_records to service_role;
-- Intentionally no GRANT to anon or authenticated.

-- ─── Profile RPCs: add can_manage_attendance only (SECURITY DEFINER, no table RLS change) ───

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
    'display_name', display_name
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
      'can_manage_attendance', false,
      'display_name', display_name
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
    updated_at
  )
  values (p_user_id, false, true, false, false, false, now())
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
      updated_at
    )
    values (p_user_id, false, true, false, false, now())
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
exception
  when undefined_column then
    insert into public.app_profiles (
      user_id,
      can_manage_blogs,
      can_manage_tasks,
      can_administer_tasks,
      can_manage_users,
      updated_at
    )
    values (p_user_id, true, true, true, true, now())
    on conflict (user_id) do update
      set
        can_manage_blogs = true,
        can_manage_tasks = true,
        can_administer_tasks = true,
        can_manage_users = true,
        updated_at = now();
end;
$$;

-- New 7-arg signature; drop legacy 6-arg overload so PostgREST resolves unambiguously.
drop function if exists public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, text);

create or replace function public.svc_upsert_app_profile(
  p_user_id uuid,
  p_can_manage_blogs boolean,
  p_can_manage_tasks boolean,
  p_can_administer_tasks boolean,
  p_can_manage_users boolean,
  p_can_manage_attendance boolean,
  p_display_name text
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
    display_name,
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
      updated_at = now();
exception
  when undefined_column then
    insert into public.app_profiles (
      user_id,
      can_manage_blogs,
      can_manage_tasks,
      can_administer_tasks,
      can_manage_users,
      display_name,
      updated_at
    )
    values (
      p_user_id,
      coalesce(p_can_manage_blogs, false),
      coalesce(p_can_manage_tasks, true),
      coalesce(p_can_administer_tasks, false),
      coalesce(p_can_manage_users, false),
      nullif(trim(p_display_name), ''),
      now()
    )
    on conflict (user_id) do update
      set
        can_manage_blogs = excluded.can_manage_blogs,
        can_manage_tasks = excluded.can_manage_tasks,
        can_administer_tasks = excluded.can_administer_tasks,
        can_manage_users = excluded.can_manage_users,
        display_name = excluded.display_name,
        updated_at = now();
end;
$$;

revoke all on function public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, boolean, text) from public;
grant execute on function public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, boolean, text) to service_role;
