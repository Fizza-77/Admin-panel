import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { AppPermissions } from '@/lib/permissions/types';
import { LoadingOverlay } from '@/components/ui/Spinner';
import UserAvatar from '@/components/ui/UserAvatar';
import { userDisplayLabel } from '@/lib/users/display';
import { reportError } from '@/lib/monitoring';
import { todayDateInputValue, type AttendanceRow } from '@/lib/attendance/types';

export const getServerSideProps = requireAuthentication(
  requirePermission({ attendance: true }, async () => ({ props: {} })),
);

export default function AttendanceEmployeesPage({ permissions }: { permissions: AppPermissions }) {
  const [roster, setRoster] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?date=${encodeURIComponent(todayDateInputValue())}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load employees');
      }
      const list = Array.isArray(body?.rows) ? (body.rows as AttendanceRow[]) : [];
      setRoster(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load employees';
      setLoadError(msg);
      reportError(e, { source: 'AttendanceEmployeesPage.load' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminLayout permissions={permissions}>
      {loading && <LoadingOverlay messages={['Loading employees…', 'Fetching team roster…']} rotateIntervalMs={3000} />}
      <Head>
        <title>All employees - Skyen Admin</title>
      </Head>

      <div className="mx-auto w-full max-w-4xl">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <h1 className="text-lg font-semibold text-slate-900">All employees</h1>
            <p className="mt-0.5 text-sm text-slate-500">Team roster — more details coming soon.</p>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roster.map((row) => (
                    <tr key={row.user_id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <span className="inline-flex items-center gap-2.5">
                          <UserAvatar
                            label={userDisplayLabel(row.display_name, row.email)}
                            avatarUrl={row.avatar_url}
                            size="sm"
                          />
                          <span>{row.display_name || '—'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.email ?? '—'}</td>
                    </tr>
                  ))}
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
