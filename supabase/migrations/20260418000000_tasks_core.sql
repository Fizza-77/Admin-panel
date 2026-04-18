-- Task management (ClickUp-style). Additive only: does NOT modify blog tables.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'to_do'
    check (status in ('to_do', 'in_progress', 'ready', 'closed')),
  visibility text not null default 'private'
    check (visibility in ('private', 'workspace')),
  due_at timestamptz,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_created_by_idx on public.tasks (created_by);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_updated_at_idx on public.tasks (updated_at desc);

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists task_assignees_user_id_idx on public.task_assignees (user_id);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint tags_name_unique unique (name)
);

create table if not exists public.task_tag_links (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

create index if not exists task_tag_links_tag_id_idx on public.task_tag_links (tag_id);

alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.tags enable row level security;
alter table public.task_tag_links enable row level security;

-- Server uses service role; no policies needed for anon client reads here.

comment on table public.tasks is 'Admin task board; visibility private = creator+assignees+admins; workspace = all task users';
comment on column public.tasks.visibility is 'private: only creator, assignees, and can_manage_users; workspace: visible to all can_manage_tasks users';
