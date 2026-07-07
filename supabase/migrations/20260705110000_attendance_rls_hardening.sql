-- Optional patch if 20260705100000 was applied before RLS hardening.
-- Safe: only touches attendance_records policies; does not modify blogs/sites/app_profiles RLS.

drop policy if exists "service_role_all_attendance_records" on public.attendance_records;
create policy "service_role_all_attendance_records"
  on public.attendance_records
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "attendance_records_deny_client_roles" on public.attendance_records;
create policy "attendance_records_deny_client_roles"
  on public.attendance_records
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.attendance_records to service_role;
