import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Download, Mail } from 'lucide-react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { AppPermissions } from '@/lib/permissions/types';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { reportError } from '@/lib/monitoring';
import UserAvatar from '@/components/ui/UserAvatar';
import { employeeFullName, formatEmployeeSalary } from '@/lib/employees/profile';
import { userDisplayLabel } from '@/lib/users/display';
import type { PayrollEmployeeRow } from '@/lib/payroll/types';
import type { PayPeriod } from '@/lib/payroll/payPeriod';

export const getServerSideProps = requireAuthentication(
  requirePermission({ attendance: true }, async () => ({ props: {} })),
);

type RowActionState = {
  downloading: boolean;
  sending: boolean;
  message: string | null;
  error: string | null;
};

const idleRowAction: RowActionState = {
  downloading: false,
  sending: false,
  message: null,
  error: null,
};

export default function PayrollPage({ permissions }: { permissions: AppPermissions }) {
  const router = useRouter();
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([]);
  const [payPeriod, setPayPeriod] = useState<PayPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowActions, setRowActions] = useState<Record<string, RowActionState>>({});

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/payroll', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load payroll');
      }

      const list = Array.isArray(body?.employees) ? (body.employees as PayrollEmployeeRow[]) : [];
      setEmployees(list);
      setPayPeriod(body?.pay_period ?? null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load payroll';
      setLoadError(msg);
      reportError(e, { source: 'PayrollPage.load' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRowAction = (userId: string, patch: Partial<RowActionState>) => {
    setRowActions((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? idleRowAction), ...patch },
    }));
  };

  const downloadReceipt = async (userId: string) => {
    updateRowAction(userId, { downloading: true, error: null, message: null });
    try {
      const res = await fetch(`/api/payroll/${encodeURIComponent(userId)}/receipt`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to download receipt');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? 'payroll-receipt.pdf';

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to download receipt';
      updateRowAction(userId, { error: msg });
      reportError(e, { source: 'PayrollPage.downloadReceipt', userId });
    } finally {
      updateRowAction(userId, { downloading: false });
    }
  };

  const sendReceipt = async (userId: string) => {
    updateRowAction(userId, { sending: true, error: null, message: null });
    try {
      const res = await fetch(`/api/payroll/${encodeURIComponent(userId)}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to send receipt');
      }
      updateRowAction(userId, { message: typeof body?.message === 'string' ? body.message : 'Receipt sent.' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send receipt';
      updateRowAction(userId, { error: msg });
      reportError(e, { source: 'PayrollPage.sendReceipt', userId });
    } finally {
      updateRowAction(userId, { sending: false });
    }
  };

  const openEmployee = (userId: string) => {
    void router.push(`/employees/${encodeURIComponent(userId)}`);
  };

  return (
    <AdminLayout permissions={permissions}>
      {loading && (
        <LoadingOverlay messages={['Loading payroll…', 'Fetching employee salaries…']} rotateIntervalMs={3000} />
      )}
      <Head>
        <title>Payroll - Skyen Admin</title>
      </Head>

      <div className="relative mx-auto w-full max-w-4xl space-y-4">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <h1 className="text-lg font-semibold text-slate-900">Payroll</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {payPeriod
                ? `${payPeriod.payMonthName} salary receipts — pay period ${payPeriod.payPeriodLabel}`
                : 'Send and download monthly salary receipts for each employee.'}
            </p>
          </div>

          {loadError ? (
            <p className="p-5 text-red-600">{loadError}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {employees.map((employee) => {
                const displayName = employeeFullName(
                  employee.display_name,
                  employee.surname,
                  employee.email,
                );
                const action = rowActions[employee.user_id] ?? idleRowAction;
                const role = employee.company_role?.trim() || '—';
                const salary = formatEmployeeSalary(employee.salary);

                return (
                  <li key={employee.user_id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4 sm:block">
                          <button
                            type="button"
                            onClick={() => openEmployee(employee.user_id)}
                            aria-label={`View profile for ${displayName}`}
                            className="flex min-w-0 items-center gap-3 rounded-lg text-left transition hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 -m-1 p-1"
                          >
                            <UserAvatar
                              label={userDisplayLabel(
                                employee.display_name,
                                employee.email,
                                employee.surname,
                              )}
                              avatarUrl={employee.avatar_url}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900">{displayName}</p>
                              <p className="truncate text-sm text-slate-500">{role}</p>
                            </div>
                          </button>
                          <p className="shrink-0 text-sm font-semibold text-slate-900 sm:hidden">{salary}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <p className="hidden text-sm font-semibold text-slate-900 sm:mr-2 sm:block">{salary}</p>
                        <button
                          type="button"
                          onClick={() => void downloadReceipt(employee.user_id)}
                          disabled={action.downloading || action.sending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" aria-hidden />
                          {action.downloading ? 'Downloading…' : 'Download'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void sendReceipt(employee.user_id)}
                          disabled={action.downloading || action.sending || !employee.email}
                          title={employee.email ? undefined : 'No email on file'}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#5B5CEB]/30 bg-[#5B5CEB]/10 px-3 py-2 text-sm font-medium text-[#5B5CEB] hover:bg-[#5B5CEB]/15 disabled:opacity-50"
                        >
                          <Mail className="h-4 w-4" aria-hidden />
                          {action.sending ? 'Sending…' : 'Send Receipt'}
                        </button>
                      </div>
                    </div>

                    {action.message && <p className="mt-2 text-sm text-emerald-700">{action.message}</p>}
                    {action.error && <p className="mt-2 text-sm text-red-600">{action.error}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && !loadError && employees.length === 0 && (
            <p className="p-6 text-slate-500">No employees found.</p>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
