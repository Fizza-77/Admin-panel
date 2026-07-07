-- Task document attachments (files stored in Cloudinary; metadata here).

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text,
  file_size bigint,
  uploaded_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists task_attachments_task_id_idx
  on public.task_attachments (task_id, created_at desc);

comment on table public.task_attachments is
  'Files attached to tasks. Server-only via service_role.';

alter table public.task_attachments enable row level security;

drop policy if exists "service_role_all_task_attachments" on public.task_attachments;
create policy "service_role_all_task_attachments"
  on public.task_attachments
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "task_attachments_deny_client_roles" on public.task_attachments;
create policy "task_attachments_deny_client_roles"
  on public.task_attachments
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.task_attachments to service_role;
