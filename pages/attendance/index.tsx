import Head from 'next/head';
import Link from 'next/link';
import type { GetServerSidePropsContext } from 'next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, ClipboardList, List } from 'lucide-react';
import { requireAuthentication } from '@/lib/auth';
import { resolveAdminUserContextFromGssp } from '@/lib/auth/resolveUserContext';
import AdminLayout from '@/components/Layout/AdminLayout';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';
import AttendanceLegend from '@/components/attendance/AttendanceLegend';
import AttendanceListView from '@/components/attendance/AttendanceListView';
import AttendanceReports from '@/components/attendance/AttendanceReports';
import type { AppPermissions } from '@/lib/permissions/types';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { reportError } from '@/lib/monitoring';
import {
  composeMonth,
  monthYearParts,
  shiftMonth,
  yearOptions,
} from '@/lib/attendance/calendarGrid';
import {
  monthInputValue,
  monthDateRange,
  todayDateInputValue,
  type AttendanceStatus,
  type PersonalAttendanceEntry,
} from '@/lib/attendance/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type ViewMode = 'calendar' | 'list';

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
  const ctx = await resolveAdminUserContextFromGssp(context);
  if (!ctx) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  if (ctx.profileLoadError && !ctx.permissions.isPrimaryAdmin) {
    return {
      redirect: {
        destination: `/profile-error?message=${encodeURIComponent(ctx.profileLoadError)}`,
        permanent: false,
      },
    };
  }
  return { props: { permissions: ctx.permissions } };
});

export default function MyAttendancePage({ permissions }: { permissions: AppPermissions }) {
  const [month, setMonth] = useState(monthInputValue());
  const [view, setView] = useState<ViewMode>('calendar');
  const [records, setRecords] = useState<PersonalAttendanceEntry[]>([]);
  const [yearLeaveRecords, setYearLeaveRecords] = useState<
    Array<{ attendance_date: string; status: AttendanceStatus; late_hours: number | null }>
  >([]);
  const [monthRange, setMonthRange] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canMark = permissions.canManageAttendance || permissions.isPrimaryAdmin;
  const today = todayDateInputValue();
  const { year, monthIndex } = monthYearParts(month);

  const load = useCallback(async (targetMonth: string) => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/me?month=${encodeURIComponent(targetMonth)}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof body?.detail === 'string' ? body.detail : null;
        const msg = body?.message || 'Failed to load your attendance';
        throw new Error(detail ? `${msg} (${detail})` : msg);
      }
      setRecords(Array.isArray(body?.records) ? (body.records as PersonalAttendanceEntry[]) : []);
      setYearLeaveRecords(
        Array.isArray(body?.yearLeaveRecords) ? body.yearLeaveRecords : [],
      );
      setMonthRange(
        typeof body?.from === 'string' && typeof body?.to === 'string'
          ? { from: body.from, to: body.to }
          : monthDateRange(targetMonth),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load your attendance';
      setLoadError(msg);
      reportError(e, { source: 'MyAttendancePage.load', month: targetMonth });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [month, load]);

  const recordsByDate = useMemo(() => {
    const map = new Map<
      string,
      { status: AttendanceStatus | null; notes: string | null; late_hours: number | null }
    >();
    for (const r of records) {
      map.set(r.attendance_date, {
        status: r.status,
        notes: r.notes,
        late_hours: r.late_hours,
      });
    }
    return map;
  }, [records]);

  const reportRecords = useMemo(
    () =>
      records.map((r) => ({
        attendance_date: r.attendance_date,
        status: r.status,
        late_hours: r.late_hours,
      })),
    [records],
  );

  const monthLabel =
    (() => {
      try {
        return format(new Date(year, monthIndex - 1, 1), 'MMMM yyyy');
      } catch {
        return month;
      }
    })();

  const overlayMessages = loading ? ['Loading your attendance…', 'Fetching records…', 'Almost ready…'] : null;

  return (
    <AdminLayout permissions={permissions}>
      {overlayMessages && <LoadingOverlay messages={overlayMessages} rotateIntervalMs={3000} />}
      <Head>
        <title>My Attendance - Skyen Admin</title>
      </Head>

      <div className="att-page relative mx-auto w-full max-w-4xl space-y-4">
        {canMark && (
          <div className="att-mark-link flex justify-end">
            <Link
              href="/attendance/manage"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50"
            >
              <ClipboardList className="h-3.5 w-3.5 text-cyan-600" aria-hidden />
              Mark team attendance
            </Link>
          </div>
        )}

        <div className="att-month-toolbar">
        <div className="att-month-header">
          <div className="att-month-header-left">
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
          </div>
          <h2 className="att-month-title">{monthLabel}</h2>
          <div className="att-month-header-legend">
            <AttendanceLegend />
          </div>
        </div>

        <div className="att-controls-row">
          <div className="att-controls-nav">
            <button
              type="button"
              className="att-nav-btn"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <label className="sr-only" htmlFor="att-month-select">Month</label>
            <select
              id="att-month-select"
              className="att-select"
              value={monthIndex}
              onChange={(e) => setMonth(composeMonth(year, Number(e.target.value)))}
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="att-year-select">Year</label>
            <select
              id="att-year-select"
              className="att-select"
              value={year}
              onChange={(e) => setMonth(composeMonth(Number(e.target.value), monthIndex))}
            >
              {yearOptions(new Date().getFullYear()).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="att-nav-btn"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {loadError ? (
            <div>
              <p className="text-red-600">{loadError}</p>
              {loadError.includes('20260705100000_attendance_system') && (
                <p className="mt-2 text-sm text-slate-600">
                  Run the attendance migrations in Supabase SQL Editor, then refresh.
                </p>
              )}
            </div>
          ) : view === 'calendar' ? (
            <AttendanceCalendar month={month} today={today} recordsByDate={recordsByDate} />
          ) : (
            <AttendanceListView month={month} today={today} recordsByDate={recordsByDate} />
          )}
        </section>

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
    </AdminLayout>
  );
}
