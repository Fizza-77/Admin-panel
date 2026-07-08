import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { AppPermissions } from '@/lib/permissions/types';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { reportError } from '@/lib/monitoring';
import AttendanceReports from '@/components/attendance/AttendanceReports';
import UserAvatar from '@/components/ui/UserAvatar';
import { userDisplayLabel } from '@/lib/users/display';
import {
  composeMonth,
  monthYearParts,
  shiftMonth,
  yearOptions,
} from '@/lib/attendance/calendarGrid';
import { monthDateRange, monthInputValue, todayDateInputValue } from '@/lib/attendance/types';
import { type AttendanceRow } from '@/lib/attendance/types';
import type { AttendanceRecordSlice } from '@/lib/attendance/reports';
import type { AttendanceStatus } from '@/lib/attendance/types';

export const getServerSideProps = requireAuthentication(
  requirePermission({ attendance: true }, async () => ({ props: {} })),
);

export default function AttendanceEmployeeReportsPage({ permissions }: { permissions: AppPermissions }) {
  const router = useRouter();
  const userId = typeof router.query.userId === 'string' ? router.query.userId : null;

  const today = todayDateInputValue();

  const [month, setMonth] = useState(() => monthInputValue());
  const { year, monthIndex } = monthYearParts(month);

  const monthLabel = useMemo(() => {
    try {
      return format(new Date(year, monthIndex - 1, 1), 'MMMM yyyy');
    } catch {
      return month;
    }
  }, [month, monthIndex, year]);

  const [employee, setEmployee] = useState<AttendanceRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [monthFrom, setMonthFrom] = useState<string | null>(null);
  const [monthTo, setMonthTo] = useState<string | null>(null);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecordSlice[]>([]);
  const [yearLeaveRecords, setYearLeaveRecords] = useState<AttendanceRecordSlice[]>([]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }
    const qMonth = typeof router.query.month === 'string' ? router.query.month.trim() : null;
    if (qMonth && monthDateRange(qMonth)) {
      setMonth(qMonth);
    }
  }, [router.isReady, router.query.month]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    // Only used for the header (display name/email/avatar).
    // Attendance reports come from /api/attendance/users/[userId].
    void (async () => {
      try {
        const res = await fetch(`/api/attendance?date=${encodeURIComponent(today)}`, {
          credentials: 'include',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || 'Failed to load employee info');
        }
        const list = Array.isArray(body?.rows) ? (body.rows as AttendanceRow[]) : [];
        setEmployee(list.find((r) => r.user_id === userId) ?? null);
      } catch (e: unknown) {
        reportError(e, { source: 'AttendanceEmployeeReportsPage.employeeInfo.load', userId });
      }
    })();
  }, [today, userId]);

  const loadReports = useCallback(
    async (targetMonth: string) => {
      if (!userId) {
        return;
      }

      setLoadError(null);
      setLoading(true);
      try {
        const res = await fetch(
          `/api/attendance/users/${encodeURIComponent(userId)}?month=${encodeURIComponent(targetMonth)}`,
          { credentials: 'include' },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail = typeof body?.detail === 'string' ? body.detail : null;
          const msg = body?.message || 'Failed to load employee attendance';
          throw new Error(detail ? `${msg} (${detail})` : msg);
        }

        const from = typeof body?.from === 'string' ? body.from : monthDateRange(targetMonth)?.from ?? null;
        const to = typeof body?.to === 'string' ? body.to : monthDateRange(targetMonth)?.to ?? null;
        if (!from || !to) {
          throw new Error('Invalid month range');
        }

        type ApiAttendanceRecord = {
          attendance_date?: unknown;
          status?: unknown;
          late_hours?: unknown;
        };

        const records = Array.isArray(body?.records) ? (body.records as ApiAttendanceRecord[]) : [];
        const yearLeaves = Array.isArray(body?.yearLeaveRecords)
          ? (body.yearLeaveRecords as ApiAttendanceRecord[])
          : [];

        setMonthFrom(from);
        setMonthTo(to);
        setMonthRecords(
          records.map(
            (r) =>
              ({
                attendance_date: String(r.attendance_date ?? '').slice(0, 10),
                status: r.status as AttendanceStatus,
                late_hours: r.late_hours != null ? Number(r.late_hours) : null,
              }) satisfies AttendanceRecordSlice,
          ),
        );
        setYearLeaveRecords(
          yearLeaves.map(
            (r) =>
              ({
                attendance_date: String(r.attendance_date ?? '').slice(0, 10),
                status: r.status as AttendanceStatus,
                late_hours: r.late_hours != null ? Number(r.late_hours) : null,
              }) satisfies AttendanceRecordSlice,
          ),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load employee attendance';
        setLoadError(msg);
        reportError(e, { source: 'AttendanceEmployeeReportsPage.loadReports', userId, month: targetMonth });
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      return;
    }
    void loadReports(month);
  }, [loadReports, month, userId]);

  return (
    <AdminLayout permissions={permissions}>
      <Head>
        <title>Employee attendance - Skyen Admin</title>
      </Head>

      {loading && (
        <LoadingOverlay messages={['Loading reports…', 'Fetching weekly and monthly summaries…']} rotateIntervalMs={2800} />
      )}

      <div className="att-page relative mx-auto w-full max-w-4xl space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar
                  label={userDisplayLabel(employee?.display_name ?? null, employee?.email ?? null)}
                  avatarUrl={employee?.avatar_url ?? null}
                  size="sm"
                />
                <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  {employee?.display_name || employee?.email || 'Employee'} attendance
                </h1>
                  <p className="text-sm text-slate-500">{monthLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
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

                <label className="sr-only" htmlFor="att-employee-month-select">
                  Month
                </label>
                <select
                  id="att-employee-month-select"
                  className="att-select"
                  value={monthIndex}
                  onChange={(e) => setMonth(composeMonth(year, Number(e.target.value)))}
                >
                  {[...Array(12)].map((_, idx) => {
                    const monthNum = idx + 1;
                    const label = format(new Date(year, monthNum - 1, 1), 'MMMM');
                    return (
                      <option key={monthNum} value={monthNum}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                <label className="sr-only" htmlFor="att-employee-year-select">
                  Year
                </label>
                <select
                  id="att-employee-year-select"
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

          {loadError ? (
            <p className="p-5 text-red-600">{loadError}</p>
          ) : (
            <div className="p-4 sm:p-5">
              {monthFrom && monthTo ? (
                <AttendanceReports
                  monthFrom={monthFrom}
                  monthTo={monthTo}
                  today={today}
                  monthRecords={monthRecords}
                  yearLeaveRecords={yearLeaveRecords}
                />
              ) : (
                <p className="text-slate-600">Select a valid month.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

