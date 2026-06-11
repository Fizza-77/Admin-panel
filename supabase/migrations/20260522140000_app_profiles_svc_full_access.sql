-- Full-access bootstrap for owner emails (see ADMIN_APP_OWNER_EMAILS).

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
exception
  when undefined_column then
    insert into public.app_profiles (
      user_id,
      can_manage_blogs,
      can_manage_tasks,
      can_manage_users,
      updated_at
    )
    values (p_user_id, true, true, true, now())
    on conflict (user_id) do update
      set
        can_manage_blogs = true,
        can_manage_tasks = true,
        can_manage_users = true,
        updated_at = now();
end;
$$;

revoke all on function public.svc_upsert_full_access_app_profile(uuid) from public;
grant execute on function public.svc_upsert_full_access_app_profile(uuid) to service_role;
