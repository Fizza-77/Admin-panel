import { monthDateRange } from '@/lib/attendance/types';

/** Sunday = weekly off. Mon–Sat are working days. */
export function parseDateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00`);
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

export function isWorkingDay(date: Date): boolean {
  return !isSunday(date);
}

export function isWorkingDayString(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10))) {
    return false;
  }
  return isWorkingDay(parseDateOnly(iso));
}

export function eachDayInMonth(month: string): string[] {
  const range = monthDateRange(month);
  if (!range) {
    return [];
  }
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    out.push(`${month}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

export function countWorkingDaysInMonth(month: string): number {
  return eachDayInMonth(month).filter((d) => isWorkingDayString(d)).length;
}

export function countOffDaysInMonth(month: string): number {
  return eachDayInMonth(month).filter((d) => !isWorkingDayString(d)).length;
}

export const OFF_DAY_LABEL = 'Day off';
