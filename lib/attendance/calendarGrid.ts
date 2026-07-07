import { parseDateOnly } from '@/lib/attendance/workingDays';

export type CalendarCell = {
  date: string | null;
  day: number | null;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export { WEEKDAYS };

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

export function buildMonthCalendarGrid(month: string): CalendarCell[] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startPad = first.getDay();

  const cells: CalendarCell[] = [];

  for (let i = 0; i < startPad; i++) {
    cells.push({ date: null, day: null });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    cells.push({ date, day: d });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }

  return cells;
}

export function monthYearParts(month: string): { year: number; monthIndex: number } {
  const [y, m] = month.split('-').map(Number);
  return { year: y, monthIndex: m };
}

export function composeMonth(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex).padStart(2, '0')}`;
}

export function yearOptions(anchorYear: number, span = 3): number[] {
  const out: number[] = [];
  for (let y = anchorYear - span; y <= anchorYear + span; y++) {
    out.push(y);
  }
  return out;
}

export function dayOfWeekShort(dateIso: string): string {
  try {
    return parseDateOnly(dateIso).toLocaleDateString('en-US', { weekday: 'short' });
  } catch {
    return '';
  }
}
