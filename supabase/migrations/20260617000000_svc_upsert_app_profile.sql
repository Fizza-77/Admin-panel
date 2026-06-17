-- Custom app_profiles upsert for user management (SECURITY DEFINER bypasses RLS).

create or replace function public.svc_upsert_app_profile(
  p_user_id uuid,
  p_can_manage_blogs boolean,
  p_can_manage_tasks boolean,
  p_can_administer_tasks boolean,
  p_can_manage_users boolean,
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
exception
  when undefined_column then
    insert into public.app_profiles (
      user_id,
      can_manage_blogs,
      can_manage_tasks,
      can_manage_users,
      updated_at
    )
    values (
      p_user_id,
      coalesce(p_can_manage_blogs, false),
      coalesce(p_can_manage_tasks, true),
      coalesce(p_can_manage_users, false),
      now()
    )
    on conflict (user_id) do update
      set
        can_manage_blogs = excluded.can_manage_blogs,
        can_manage_tasks = excluded.can_manage_tasks,
        can_manage_users = excluded.can_manage_users,
        updated_at = now();
end;
$$;

revoke all on function public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, text) from public;
grant execute on function public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, text) to service_role;
