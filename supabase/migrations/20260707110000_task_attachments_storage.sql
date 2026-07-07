-- Private storage bucket for task attachments (PDF, docs, images).
-- Files are served through the app API proxy using the service_role key,
-- so the bucket stays private and is never exposed to anon/authenticated roles.

insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do update set public = false;

-- Only the service_role (server API routes) may read/write objects in this bucket.
drop policy if exists "task_attachments_service_role_all" on storage.objects;
create policy "task_attachments_service_role_all"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'task-attachments')
  with check (bucket_id = 'task-attachments');
