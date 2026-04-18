-- Feature flags per authenticated user (blogs / tasks / user management).
-- Server APIs use the service role and enforce access in application code.
--
-- SAFETY: This migration is additive only. It does NOT alter public.blogs, public.sites,
-- public.blog_categories, public.blog_reactions, or any existing blog RLS policies.
-- The public blog site (anon reads, etc.) is unaffected.

create table if not exists public.app_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  can_manage_blogs boolean not null default false,
  can_manage_tasks boolean not null default false,
  can_manage_users boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_profiles_updated_at_idx on public.app_profiles (updated_at desc);

alter table public.app_profiles enable row level security;

-- Optional: users reading their own row with a user-scoped Supabase client (server still uses service role).
create policy "app_profiles_select_own"
  on public.app_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
