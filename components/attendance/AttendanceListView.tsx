import { format } from 'date-fns';
import { formatLateHours } from '@/lib/attendance/reports';
import { ATTENDANCE_STATUS_LABELS } from '@/lib/attendance/types';
import { OFF_DAY_LABEL } from '@/lib/attendance/workingDays';
import { resolveDayVariant, variantToListClass } from '@/lib/attendance/display';
import { eachDayInMonth } from '@/lib/attendance/workingDays';
import type { AttendanceStatus } from '@/lib/attendance/types';

type DayRecord = {
  status: AttendanceStatus | null;
  notes: string | null;
  late_hours?: number | null;
};

type AttendanceListViewProps = {
  month: string;
  today: string;
  recordsByDate: Map<string, DayRecord>;
};

function statusLabel(variant: ReturnType<typeof resolveDayVariant>): string {
  if (variant === 'off') return OFF_DAY_LABEL;
  if (variant === 'future') return 'Upcoming';
  if (variant === 'unmarked') return 'Not marked';
  return ATTENDANCE_STATUS_LABELS[variant];
}

export default function AttendanceListView({ month, today, recordsByDate }: AttendanceListViewProps) {
  const days = eachDayInMonth(month).slice().reverse();

  return (
    <ul className="space-y-2" aria-label="Attendance list">
      {days.map((date) => {
        const rec = recordsByDate.get(date);
        const variant = resolveDayVariant(date, today, rec?.status ?? null);
        let dateLabel = date;
        let dayLabel = '';
        try {
          const d = new Date(`${date}T12:00:00`);
          dateLabel = format(d, 'MMM d, yyyy');
          dayLabel = format(d, 'EEEE');
        } catch {
          /* keep raw */
        }

        return (
          <li
            key={date}
            className={`att-list-row ${variantToListClass(variant)}`}
          >
            <div>
              <p className="font-semibold">{dateLabel}</p>
              <p className="text-xs opacity-90">{dayLabel}</p>
              {rec?.notes && <p className="mt-1 text-xs opacity-90">{rec.notes}</p>}
            </div>
            <span className="text-xs font-bold uppercase tracking-wide">
              {variant === 'late' && rec?.late_hours != null
                ? `${statusLabel(variant)} · ${formatLateHours(rec.late_hours)}`
                : statusLabel(variant)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
