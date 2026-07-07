create table if not exists public.attendance_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attendance_date date not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists attendance_notifications_user_unread_idx
  on public.attendance_notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists attendance_notifications_user_date_idx
  on public.attendance_notifications (user_id, attendance_date desc);

alter table public.attendance_notifications enable row level security;

comment on table public.attendance_notifications is
  'In-app alerts when a user''s attendance is marked by a manager.';
