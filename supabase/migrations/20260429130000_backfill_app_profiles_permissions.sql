-- Production backfill: ensure task permissions and profiles exist for all auth users.

alter table public.app_profiles
  add column if not exists can_administer_tasks boolean not null default false;

comment on column public.app_profiles.can_administer_tasks is
  'Full task admin: create tasks, edit/delete any task, manage tags, see all tasks.';

-- Basic board access for everyone who already has a profile row.
update public.app_profiles
set can_manage_tasks = true
where can_manage_tasks = false;

-- Legacy: users who had full access via can_manage_users before Tasks admin split.
update public.app_profiles
set can_administer_tasks = true
where can_administer_tasks = false
  and can_manage_users = true;

-- Create missing profile rows (basic task access; blogs/admin off until granted in user management).
insert into public.app_profiles (
  user_id,
  can_manage_blogs,
  can_manage_tasks,
  can_administer_tasks,
  can_manage_users,
  updated_at
)
select
  u.id,
  false,
  true,
  false,
  false,
  now()
from auth.users u
where not exists (
  select 1 from public.app_profiles p where p.user_id = u.id
);
