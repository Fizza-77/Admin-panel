-- Profile photo URL (Cloudinary). UI falls back to initials when null.

alter table public.app_profiles
  add column if not exists avatar_url text;

comment on column public.app_profiles.avatar_url is
  'Cloudinary URL for profile photo; UI falls back to initials when null.';

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
      'display_name', display_name,
      'avatar_url', null
    )
    into result
    from public.app_profiles
    where user_id = p_user_id;
    return result;
end;
$$;

drop function if exists public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, boolean, text);

create or replace function public.svc_upsert_app_profile(
  p_user_id uuid,
  p_can_manage_blogs boolean,
  p_can_manage_tasks boolean,
  p_can_administer_tasks boolean,
  p_can_manage_users boolean,
  p_can_manage_attendance boolean,
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
end;
$$;

revoke all on function public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, boolean, text, text) from public;
grant execute on function public.svc_upsert_app_profile(uuid, boolean, boolean, boolean, boolean, boolean, text, text) to service_role;
