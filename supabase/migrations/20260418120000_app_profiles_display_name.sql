-- Optional display name for UI (tasks, header); does not affect blog tables.

alter table public.app_profiles
  add column if not exists display_name text;

comment on column public.app_profiles.display_name is 'User-chosen label; falls back to email in UI when null';
