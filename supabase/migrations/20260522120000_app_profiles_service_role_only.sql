-- app_profiles is server-managed only (Next.js API uses SUPABASE_SERVICE_ROLE_KEY).
-- RLS blocked inserts when production accidentally used the anon key as the server key.
-- Service role bypasses RLS; anon/authenticated must not read or write permission flags directly.

drop policy if exists "app_profiles_select_own" on public.app_profiles;

-- Explicit deny for browser-facing roles (anon key is public in NEXT_PUBLIC_SUPABASE_ANON_KEY).
drop policy if exists "app_profiles_deny_client_roles" on public.app_profiles;
create policy "app_profiles_deny_client_roles"
  on public.app_profiles
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.app_profiles is
  'Admin RBAC flags. Only the service_role server client may access this table; enforced in app code.';
