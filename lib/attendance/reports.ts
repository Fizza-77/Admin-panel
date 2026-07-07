import { ATTENDANCE_LEAVE_POLICY } from '@/lib/attendance/policy';
import type { AttendanceStatus } from '@/lib/attendance/types';
import { isWorkingDayString, parseDateOnly } from '@/lib/attendance/workingDays';

export type AttendanceRecordSlice = {
  attendance_date: string;
  status: AttendanceStatus;
  late_hours: number | null;
};

export type PeriodStats = {
  from: string;
  to: string;
  workingDays: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  lateHoursTotal: number;
  leaveAllowance: number | null;
  leaveRemaining: number | null;
};

export type AttendanceReport = {
  weekly: PeriodStats;
  monthly: PeriodStats;
  yearlyLeaveUsed: number;
  yearlyLeaveAllowance: number | null;
};

function startOfWeekMonday(iso: string): string {
  const d = parseDateOnly(iso);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeekSunday(weekStartIso: string): string {
  const d = parseDateOnly(weekStartIso);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function clampRange(from: string, to: string, monthFrom: string, monthTo: string): { from: string; to: string } {
  const f = from < monthFrom ? monthFrom : from;
  const t = to > monthTo ? monthTo : to;
  if (f > t) {
    return { from: monthFrom, to: monthFrom };
  }
  return { from: f, to: t };
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = parseDateOnly(from);
  const end = parseDateOnly(to);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function weekAnchorForMonth(monthFrom: string, monthTo: string, today: string): string {
  if (today >= monthFrom && today <= monthTo) {
    return today;
  }
  return monthTo;
}

function sumPeriod(
  records: AttendanceRecordSlice[],
  from: string,
  to: string,
  leaveAllowance: number | null,
): PeriodStats {
  const byDate = new Map(records.map((r) => [r.attendance_date, r]));
  const days = eachDay(from, to).filter((d) => isWorkingDayString(d));

  let present = 0;
  let absent = 0;
  let late = 0;
  let leave = 0;
  let lateHoursTotal = 0;

  for (const date of days) {
    const rec = byDate.get(date);
    if (!rec) {
      continue;
    }
    switch (rec.status) {
      case 'present':
        present += 1;
        break;
      case 'absent':
        absent += 1;
        break;
      case 'late':
        late += 1;
        lateHoursTotal += rec.late_hours ?? 0;
        break;
      case 'leave':
        leave += 1;
        break;
      default:
        break;
    }
  }

  const leaveRemaining = leaveAllowance === null ? null : Math.max(0, leaveAllowance - leave);

  return {
    from,
    to,
    workingDays: days.length,
    present,
    absent,
    late,
    leave,
    lateHoursTotal: Math.round(lateHoursTotal * 100) / 100,
    leaveAllowance,
    leaveRemaining,
  };
}

export function buildAttendanceReport(
  monthRecords: AttendanceRecordSlice[],
  yearLeaveRecords: AttendanceRecordSlice[],
  monthFrom: string,
  monthTo: string,
  today: string,
): AttendanceReport {
  const anchor = weekAnchorForMonth(monthFrom, monthTo, today);
  const weekStart = startOfWeekMonday(anchor);
  const weekEnd = endOfWeekSunday(weekStart);
  const weekRange = clampRange(weekStart, weekEnd, monthFrom, monthTo);

  const yearlyLeaveUsed = yearLeaveRecords.filter((r) => r.status === 'leave').length;

  return {
    weekly: sumPeriod(monthRecords, weekRange.from, weekRange.to, null),
    monthly: sumPeriod(
      monthRecords,
      monthFrom,
      monthTo,
      ATTENDANCE_LEAVE_POLICY.monthlyLeaveDays,
    ),
    yearlyLeaveUsed,
    yearlyLeaveAllowance: ATTENDANCE_LEAVE_POLICY.yearlyLeaveDays,
  };
}

export function formatLateHours(hours: number): string {
  if (hours <= 0) {
    return '0h';
  }
  const rounded = Math.round(hours * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `${rounded}h`;
  }
  return `${rounded}h`;
}

export function percentOf(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((value / total) * 100));
}
