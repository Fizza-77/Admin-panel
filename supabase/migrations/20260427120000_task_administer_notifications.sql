-- Split task access: all panel users can use tasks; only administrators manage all tasks/tags.

alter table public.app_profiles
  add column if not exists can_administer_tasks boolean not null default false;

comment on column public.app_profiles.can_manage_tasks is
  'Basic task board access: view assigned/workspace tasks, update status on assigned tasks.';
comment on column public.app_profiles.can_administer_tasks is
  'Full task admin: create tasks, edit/delete any task, manage tags, see all tasks.';

-- Existing users get basic task access; full admin stays opt-in via user management.
update public.app_profiles
set can_manage_tasks = true
where can_manage_tasks = false;

create table if not exists public.task_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists task_notifications_user_unread_idx
  on public.task_notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists task_notifications_task_id_idx
  on public.task_notifications (task_id);

alter table public.task_notifications enable row level security;

-- Server uses service role for inserts/reads in API routes.

comment on table public.task_notifications is
  'In-app alerts when a user is assigned to a task.';
