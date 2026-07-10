-- Employee profile fields on app_profiles.
-- Personal fields (name, surname, qualification, contact) are edited by the user in Profile.
-- company_role and salary are set by attendance admins on the employee detail page.

alter table public.app_profiles
  add column if not exists surname text,
  add column if not exists qualification text,
  add column if not exists contact_info text,
  add column if not exists company_role text,
  add column if not exists salary numeric(12, 2);

comment on column public.app_profiles.display_name is 'First / given name; user-editable in Profile.';
comment on column public.app_profiles.surname is 'Last name; user-editable in Profile.';
comment on column public.app_profiles.qualification is 'Education or certification; user-editable in Profile.';
comment on column public.app_profiles.contact_info is 'Phone or other contact; user-editable in Profile.';
comment on column public.app_profiles.company_role is 'Job title or role; set by attendance admin.';
comment on column public.app_profiles.salary is 'Monthly salary (PKR); set by attendance admin.';

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
      'display_name', display_name,
      'avatar_url', avatar_url
    )
    into result
    from public.app_profiles
    where user_id = p_user_id;
    return result;
end;
$$;
