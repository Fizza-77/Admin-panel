import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, List } from 'lucide-react';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';
import AttendanceLegend from '@/components/attendance/AttendanceLegend';
import AttendanceListView from '@/components/attendance/AttendanceListView';
import AttendanceReports from '@/components/attendance/AttendanceReports';
import UserAvatar from '@/components/ui/UserAvatar';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { userDisplayLabel } from '@/lib/users/display';
import { resolveDayVariant } from '@/lib/attendance/display';
import { formatLateHours } from '@/lib/attendance/reports';
import { reportError } from '@/lib/monitoring';
import {
  ATTENDANCE_STATUS_LABELS,
  monthDateRange,
  type AttendanceRow,
  type AttendanceStatus,
  type PersonalAttendanceEntry,
} from '@/lib/attendance/types';
import { isWorkingDayString } from '@/lib/attendance/workingDays';

type ViewMode = 'calendar' | 'list';

type EmployeeAttendanceRecordProps = {
  employee: AttendanceRow;
  month: string;
  today: string;
  isExpanded: boolean;
  onToggle: () => void;
};

function todayStatusLabel(employee: AttendanceRow, today: string): string {
  if (!isWorkingDayString(today)) {
    return 'Off day';
  }
  if (!employee.status) {
    return 'Not marked';
  }
  if (employee.status === 'late' && employee.late_hours != null) {
    return `${ATTENDANCE_STATUS_LABELS.late} · ${formatLateHours(employee.late_hours)}`;
  }
  return ATTENDANCE_STATUS_LABELS[employee.status];
}

function todayStatusClass(employee: AttendanceRow, today: string): string {
  const variant = resolveDayVariant(today, today, employee.status);
  return `att-emp-status att-emp-status--${variant}`;
}

export default function EmployeeAttendanceRecord({
  employee,
  month,
  today,
  isExpanded,
  onToggle,
}: EmployeeAttendanceRecordProps) {
  const [view, setView] = useState<ViewMode>('calendar');
  const [records, setRecords] = useState<PersonalAttendanceEntry[]>([]);
  const [yearLeaveRecords, setYearLeaveRecords] = useState<
    Array<{ attendance_date: string; status: AttendanceStatus; late_hours: number | null }>
  >([]);
  const [monthRange, setMonthRange] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/attendance/users/${encodeURIComponent(employee.user_id)}?month=${encodeURIComponent(month)}`,
        { credentials: 'include' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof body?.detail === 'string' ? body.detail : null;
        const msg = body?.message || 'Failed to load attendance';
        throw new Error(detail ? `${msg} (${detail})` : msg);
      }
      setRecords(Array.isArray(body?.records) ? (body.records as PersonalAttendanceEntry[]) : []);
      setYearLeaveRecords(Array.isArray(body?.yearLeaveRecords) ? body.yearLeaveRecords : []);
      setMonthRange(
        typeof body?.from === 'string' && typeof body?.to === 'string'
          ? { from: body.from, to: body.to }
          : monthDateRange(month),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load attendance';
      setLoadError(msg);
      reportError(e, {
        source: 'EmployeeAttendanceRecord.load',
        userId: employee.user_id,
        month,
      });
    } finally {
      setLoading(false);
    }
  }, [employee.user_id, month]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }
    void load();
  }, [isExpanded, load]);

  const recordsByDate = useMemo(() => {
    const map = new Map<
      string,
      { status: AttendanceStatus | null; notes: string | null; late_hours: number | null }
    >();
    for (const record of records) {
      map.set(record.attendance_date, {
        status: record.status,
        notes: record.notes,
        late_hours: record.late_hours,
      });
    }
    return map;
  }, [records]);

  const reportRecords = useMemo(
    () =>
      records.map((record) => ({
        attendance_date: record.attendance_date,
        status: record.status,
        late_hours: record.late_hours,
      })),
    [records],
  );

  const displayName = employee.display_name || employee.email || 'Employee';

  return (
    <article className={`att-emp-card${isExpanded ? ' att-emp-card--expanded' : ''}`}>
      <button
        type="button"
        className="att-emp-card-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span className="att-emp-card-identity">
          <UserAvatar
            label={userDisplayLabel(employee.display_name, employee.email)}
            avatarUrl={employee.avatar_url}
            size="sm"
          />
          <span className="att-emp-card-text">
            <span className="att-emp-card-name">{displayName}</span>
            {employee.email && employee.display_name ? (
              <span className="att-emp-card-email">{employee.email}</span>
            ) : null}
          </span>
        </span>
        <span className="att-emp-card-meta">
          <span className={todayStatusClass(employee, today)}>{todayStatusLabel(employee, today)}</span>
          <ChevronDown className={`att-emp-chevron${isExpanded ? ' att-emp-chevron--open' : ''}`} aria-hidden />
        </span>
      </button>

      {isExpanded && (
        <div className="att-emp-card-body">
          {loading && (
            <LoadingOverlay
              messages={['Loading attendance…', 'Fetching records…']}
              rotateIntervalMs={2800}
            />
          )}

          <div className="att-emp-view-toolbar">
            <div className="att-view-toggle" role="group" aria-label="View mode">
              <button
                type="button"
                className={`att-view-toggle-btn${view === 'calendar' ? ' att-view-toggle-btn--active' : ''}`}
                onClick={() => setView('calendar')}
                aria-pressed={view === 'calendar'}
                title="Calendar view"
              >
                <Calendar className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className={`att-view-toggle-btn${view === 'list' ? ' att-view-toggle-btn--active' : ''}`}
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
                title="List view"
              >
                <List className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <AttendanceLegend />
          </div>

          {loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : view === 'calendar' ? (
            <AttendanceCalendar month={month} today={today} recordsByDate={recordsByDate} />
          ) : (
            <AttendanceListView month={month} today={today} recordsByDate={recordsByDate} />
          )}

          {!loadError && monthRange && (
            <AttendanceReports
              monthFrom={monthRange.from}
              monthTo={monthRange.to}
              today={today}
              monthRecords={reportRecords}
              yearLeaveRecords={yearLeaveRecords}
            />
          )}
        </div>
      )}
    </article>
  );
}
