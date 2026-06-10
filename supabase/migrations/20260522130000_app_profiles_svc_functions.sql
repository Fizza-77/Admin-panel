-- Server-side profile access via SECURITY DEFINER (bypasses RLS inside the function).
-- Callable only by the service_role JWT — not by anon/authenticated clients.

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
    updated_at
  )
  values (p_user_id, false, true, false, false, now())
  on conflict (user_id) do update
    set updated_at = excluded.updated_at;
exception
  when undefined_column then
    insert into public.app_profiles (
      user_id,
      can_manage_blogs,
      can_manage_tasks,
      can_manage_users,
      updated_at
    )
    values (p_user_id, false, true, false, now())
    on conflict (user_id) do update
      set updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.svc_get_app_profile(uuid) from public;
revoke all on function public.svc_upsert_default_app_profile(uuid) from public;
grant execute on function public.svc_get_app_profile(uuid) to service_role;
grant execute on function public.svc_upsert_default_app_profile(uuid) to service_role;

-- Remove restrictive deny policy (service_role bypasses RLS; this policy is not needed
-- and can interact badly with some PostgREST configurations).
drop policy if exists "app_profiles_deny_client_roles" on public.app_profiles;
