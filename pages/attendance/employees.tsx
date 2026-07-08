import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { AppPermissions } from '@/lib/permissions/types';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { reportError } from '@/lib/monitoring';
import UserAvatar from '@/components/ui/UserAvatar';
import { userDisplayLabel } from '@/lib/users/display';
import type { AttendanceRow, AttendanceStatus } from '@/lib/attendance/types';
import { ATTENDANCE_STATUS_LABELS, todayDateInputValue } from '@/lib/attendance/types';
import { OFF_DAY_LABEL } from '@/lib/attendance/workingDays';
import { formatLateHours } from '@/lib/attendance/reports';

const getStatusLabel = (row: AttendanceRow, isWorkingDay: boolean): string => {
  if (!isWorkingDay) {
    return OFF_DAY_LABEL;
  }
  if (!row.status) {
    return 'Not marked';
  }
  if (row.status === 'late') {
    return row.late_hours != null ? `Late · ${formatLateHours(row.late_hours)}` : 'Late';
  }
  return ATTENDANCE_STATUS_LABELS[row.status as AttendanceStatus] ?? '—';
};

export const getServerSideProps = requireAuthentication(
  requirePermission({ attendance: true }, async () => ({ props: {} })),
);

export default function AttendanceEmployeesPage({ permissions }: { permissions: AppPermissions }) {
  const today = todayDateInputValue();
  const [roster, setRoster] = useState<AttendanceRow[]>([]);
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?date=${encodeURIComponent(today)}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load employees');
      }

      setIsWorkingDay(Boolean(body?.is_working_day));
      const list = Array.isArray(body?.rows) ? (body.rows as AttendanceRow[]) : [];
      setRoster(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load employees';
      setLoadError(msg);
      reportError(e, { source: 'AttendanceEmployeesPage.load' });
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminLayout permissions={permissions}>
      {loading && (
        <LoadingOverlay messages={['Loading employees…', 'Fetching team roster…']} rotateIntervalMs={3000} />
      )}
      <Head>
        <title>All employees - Skyen Admin</title>
      </Head>

      <div className="att-page relative mx-auto w-full max-w-4xl space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <h1 className="text-lg font-semibold text-slate-900">All employees</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Click an employee name to view their weekly and monthly attendance report.
            </p>
          </div>

          {loadError ? (
            <p className="p-5 text-red-600">{loadError}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Today</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roster.map((row) => {
                    const label = getStatusLabel(row, isWorkingDay);
                    const displayName = row.display_name || row.email || '—';
                    return (
                      <tr key={row.user_id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <Link
                            href={`/attendance/employees/${encodeURIComponent(row.user_id)}`}
                            className="inline-flex items-center gap-2.5 text-slate-900 hover:underline"
                          >
                            <UserAvatar
                              label={userDisplayLabel(row.display_name, row.email)}
                              avatarUrl={row.avatar_url}
                              size="sm"
                            />
                            <span>{displayName}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.email ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!loading && roster.length === 0 && (
                <p className="p-6 text-slate-500">No employees found.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
