-- Set profiles permission: All Employees directory + edit any employee's profile fields.
--
-- SAFE FOR EXISTING RLS:
--   • Does NOT alter existing table policies on app_profiles (or any other table).
--   • Only adds can_manage_profiles and updates SECURITY DEFINER RPCs.
--   • Admin API continues to use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
--   • Restrictive deny for anon/authenticated on app_profiles is left unchanged.
--
-- Deploy: run this migration, then deploy app code that calls svc_upsert_app_profile (10-arg version).

-- ─── Permission column ───
alter table public.app_profiles
  add column if not exists can_manage_profiles boolean not null default false;

comment on column public.app_profiles.can_manage_profiles is
  'When true, user may open All Employees and edit employee profile fields (name, contact, role, salary).';

-- ─── Profile RPCs: add can_manage_profiles ───

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
    'can_manage_profiles', coalesce(can_manage_profiles, false),
    'display_name', display_name,
    'surname', surname,
    'qualification', qualification,
    'contact_info', contact_info,
    'company_role', company_role,
    'salary', salary,
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
      'can_manage_expenses', coalesce(can_manage_expenses, false),
      'can_manage_profiles', false,
      'display_name', display_name,
      'surname', surname,
      'qualification', qualification,
      'contact_info', contact_info,
      'company_role', company_role,
      'salary', salary,
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
    can_manage_profiles,
    updated_at
  )
  values (p_user_id, false, true, false, false, false, false, false, now())
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
      can_manage_expenses,
      updated_at
    )
    values (p_user_id, false, true, false, false, false, false, now())
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
    can_manage_profiles,
    updated_at
  )
  values (p_user_id, true, true, true, true, true, true, true, now())
  on conflict (user_id) do update
    set
      can_manage_blogs = true,
      can_manage_tasks = true,
      can_administer_tasks = true,
      can_manage_users = true,
      can_manage_attendance = true,
      can_manage_expenses = true,
      can_manage_profiles = true,
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
end;
$$;

drop function if exists public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, boolean, boolean, text, text);

create or replace function public.svc_upsert_app_profile(
  p_user_id uuid,
  p_can_manage_blogs boolean,
  p_can_manage_tasks boolean,
  p_can_administer_tasks boolean,
  p_can_manage_users boolean,
  p_can_manage_attendance boolean,
  p_can_manage_expenses boolean,
  p_can_manage_profiles boolean,
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
    can_manage_profiles,
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
    coalesce(p_can_manage_profiles, false),
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
      can_manage_profiles = excluded.can_manage_profiles,
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
end;
$$;

revoke all on function public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text) from public;
grant execute on function public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text) to service_role;

revoke all on function public.svc_get_app_profile(uuid) from public;
grant execute on function public.svc_get_app_profile(uuid) to service_role;

revoke all on function public.svc_upsert_default_app_profile(uuid) from public;
grant execute on function public.svc_upsert_default_app_profile(uuid) to service_role;

revoke all on function public.svc_upsert_full_access_app_profile(uuid) from public;
grant execute on function public.svc_upsert_full_access_app_profile(uuid) to service_role;
