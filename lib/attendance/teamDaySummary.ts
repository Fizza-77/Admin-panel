import type { AttendanceStatus } from '@/lib/attendance/types';
import type { DayDisplayVariant } from '@/lib/attendance/display';
import { isWorkingDayString } from '@/lib/attendance/workingDays';

export type TeamDaySummary = {
  team_size: number;
  marked: number;
  unmarked: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
};

export function emptyTeamDaySummary(teamSize: number): TeamDaySummary {
  return {
    team_size: teamSize,
    marked: 0,
    unmarked: teamSize,
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
  };
}

export function resolveTeamDayVariant(
  date: string,
  today: string,
  summary: TeamDaySummary | undefined,
  teamSize: number,
): DayDisplayVariant {
  if (!isWorkingDayString(date)) {
    return 'off';
  }
  if (date > today) {
    return 'future';
  }

  const s = summary ?? emptyTeamDaySummary(teamSize);
  if (s.unmarked > 0) {
    return 'unmarked';
  }
  if (s.absent > 0) {
    return 'absent';
  }
  if (s.late > 0) {
    return 'late';
  }
  if (s.leave > 0 && s.marked === s.leave) {
    return 'leave';
  }
  if (s.marked > 0) {
    return 'present';
  }
  return 'unmarked';
}

export function teamDaySummaryTitle(summary: TeamDaySummary | undefined): string | undefined {
  if (!summary) {
    return undefined;
  }
  const parts = [
    `${summary.marked}/${summary.team_size} marked`,
    summary.present ? `${summary.present} present` : '',
    summary.late ? `${summary.late} late` : '',
    summary.absent ? `${summary.absent} absent` : '',
    summary.leave ? `${summary.leave} leave` : '',
    summary.unmarked ? `${summary.unmarked} not marked` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

export function summaryToRecordStatus(
  date: string,
  today: string,
  summary: TeamDaySummary | undefined,
  teamSize: number,
): AttendanceStatus | null {
  const variant = resolveTeamDayVariant(date, today, summary, teamSize);
  if (variant === 'off' || variant === 'future' || variant === 'unmarked') {
    return null;
  }
  return variant;
}
