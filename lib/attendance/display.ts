import type { AttendanceStatus } from '@/lib/attendance/types';
import { isWorkingDayString } from '@/lib/attendance/workingDays';

export type DayDisplayVariant = 'off' | 'future' | 'unmarked' | AttendanceStatus;

export function resolveDayVariant(
  date: string,
  today: string,
  status: AttendanceStatus | null,
): DayDisplayVariant {
  if (!isWorkingDayString(date)) {
    return 'off';
  }
  if (date > today) {
    return 'future';
  }
  if (status) {
    return status;
  }
  return 'unmarked';
}

export function variantToCalClass(variant: DayDisplayVariant): string {
  if (variant === 'off') return 'att-cal-cell--off';
  if (variant === 'future') return 'att-cal-cell--future';
  if (variant === 'unmarked') return 'att-cal-cell--unmarked';
  return `att-cal-cell--${variant}`;
}

export function variantToListClass(variant: DayDisplayVariant): string {
  if (variant === 'off') return 'att-list-row--off';
  if (variant === 'future') return 'att-list-row--future';
  if (variant === 'unmarked') return 'att-list-row--unmarked';
  return `att-list-row--${variant}`;
}
