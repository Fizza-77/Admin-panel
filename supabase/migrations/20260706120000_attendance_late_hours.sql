-- Late hours for salary deduction when status = 'late'.
alter table public.attendance_records
  add column if not exists late_hours numeric(5, 2) check (
    late_hours is null or (late_hours >= 0 and late_hours <= 24)
  );

comment on column public.attendance_records.late_hours is
  'Hours late (HR-entered when status is late). Used in monthly attendance reports.';
