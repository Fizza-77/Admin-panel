import type { DayDisplayVariant } from '@/lib/attendance/display';
import { formatLateHours } from '@/lib/attendance/reports';
import { ATTENDANCE_STATUS_LABELS } from '@/lib/attendance/types';
import { OFF_DAY_LABEL } from '@/lib/attendance/workingDays';
import { resolveDayVariant, variantToCalClass } from '@/lib/attendance/display';
import { buildMonthCalendarGrid, WEEKDAYS } from '@/lib/attendance/calendarGrid';
import type { AttendanceStatus } from '@/lib/attendance/types';

type DayRecord = {
  status: AttendanceStatus | null;
  notes: string | null;
  late_hours?: number | null;
};

type AttendanceCalendarProps = {
  month: string;
  today: string;
  recordsByDate: Map<string, DayRecord>;
  selectedDate?: string | null;
  onDayClick?: (date: string) => void;
  allowFutureDays?: boolean;
  getVariant?: (date: string, record: DayRecord | undefined) => DayDisplayVariant;
  getTitle?: (date: string, record: DayRecord | undefined, variant: DayDisplayVariant) => string | undefined;
};

export default function AttendanceCalendar({
  month,
  today,
  recordsByDate,
  selectedDate,
  onDayClick,
  allowFutureDays = false,
  getVariant,
  getTitle,
}: AttendanceCalendarProps) {
  const cells = buildMonthCalendarGrid(month);

  return (
    <div>
      <div className="att-cal mb-1" role="row">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="att-cal-weekday" role="columnheader">
            {wd}
          </div>
        ))}
      </div>
      <div className="att-cal" role="grid" aria-label="Monthly attendance calendar">
        {cells.map((cell, i) => {
          if (!cell.date) {
            return <div key={`empty-${i}`} className="att-cal-cell att-cal-cell--empty" aria-hidden />;
          }

          const rec = recordsByDate.get(cell.date);
          const variant = getVariant
            ? getVariant(cell.date, rec)
            : resolveDayVariant(cell.date, today, rec?.status ?? null);
          const isToday = cell.date === today;
          const isSelected = selectedDate === cell.date;
          const clickable =
            Boolean(onDayClick) &&
            variant !== 'off' &&
            (allowFutureDays || variant !== 'future');

          const defaultTitle = rec?.status
            ? `${ATTENDANCE_STATUS_LABELS[rec.status]}${
                rec.status === 'late' && rec.late_hours != null
                  ? ` (${formatLateHours(rec.late_hours)})`
                  : ''
              }${rec.notes ? ` — ${rec.notes}` : ''}`
            : variant === 'off'
              ? OFF_DAY_LABEL
              : undefined;

          const title = getTitle
            ? getTitle(cell.date, rec, variant) ?? defaultTitle
            : defaultTitle;

          const className = [
            'att-cal-cell',
            variantToCalClass(variant),
            isToday ? 'att-cal-cell--today' : '',
            isSelected ? 'att-cal-cell--selected' : '',
            clickable ? 'att-cal-cell--interactive' : '',
          ]
            .filter(Boolean)
            .join(' ');

          if (clickable) {
            return (
              <button
                key={cell.date}
                type="button"
                role="gridcell"
                title={title}
                aria-label={`${cell.day}${title ? `, ${title}` : ''}`}
                aria-pressed={isSelected}
                className={className}
                onClick={() => onDayClick?.(cell.date!)}
              >
                <span>{cell.day}</span>
              </button>
            );
          }

          return (
            <div
              key={cell.date}
              role="gridcell"
              title={title}
              className={className}
            >
              <span>{cell.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
