export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'leave'];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  leave: 'Leave',
};

export type AttendanceRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  status: AttendanceStatus | null;
  notes: string | null;
  late_hours: number | null;
  record_id: string | null;
};

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === 'string' && ATTENDANCE_STATUSES.includes(value as AttendanceStatus);
}

export type PersonalAttendanceEntry = {
  attendance_date: string;
  status: AttendanceStatus;
  notes: string | null;
  late_hours: number | null;
  updated_at: string;
};

export type AttendanceMarkedEntry = {
  userId: string;
  date: string;
  status: AttendanceStatus;
  lateHours: number | null;
};

export function monthInputValue(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function monthDateRange(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }
  const [y, m] = month.split('-').map(Number);
  if (!y || m < 1 || m > 12) {
    return null;
  }
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function todayDateInputValue(): string {
  return new Date().toISOString().split('T')[0];
}
