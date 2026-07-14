import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { ChevronLeft, ChevronRight, Download, Mail, MinusCircle } from 'lucide-react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { AppPermissions } from '@/lib/permissions/types';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import { reportError } from '@/lib/monitoring';
import UserAvatar from '@/components/ui/UserAvatar';
import { employeeFullName, formatEmployeeSalary } from '@/lib/employees/profile';
import { userDisplayLabel } from '@/lib/users/display';
import { monthInputValue } from '@/lib/expenses/types';
import type { PayrollEmployeeRow } from '@/lib/payroll/types';
import type { PayPeriod } from '@/lib/payroll/payPeriod';

export const getServerSideProps = requireAuthentication(
  requirePermission({ attendance: true }, async () => ({ props: {} })),
);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

function shiftMonth(month: string, delta: number): string {
  const [year, monthPart] = month.split('-').map(Number);
  const date = new Date(year, monthPart - 1 + delta, 1);
  return monthInputValue(date);
}

export default function PayrollPage({ permissions }: { permissions: AppPermissions }) {
  const router = useRouter();
  const [month, setMonth] = useState(monthInputValue());
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([]);
  const [payPeriod, setPayPeriod] = useState<PayPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowActions, setRowActions] = useState<Record<string, RowActionState>>({});
  const [deductTarget, setDeductTarget] = useState<PayrollEmployeeRow | null>(null);
  const [deductAmount, setDeductAmount] = useState('');
  const [deductSaving, setDeductSaving] = useState(false);
  const [deductError, setDeductError] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    const [year, monthPart] = month.split('-').map(Number);
    return `${MONTH_NAMES[monthPart - 1]} ${year}`;
  }, [month]);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll?month=${encodeURIComponent(month)}`, {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load payroll');
      }

      const list = Array.isArray(body?.employees) ? (body.employees as PayrollEmployeeRow[]) : [];
      setEmployees(list);
      setPayPeriod(body?.pay_period ?? null);
      setRowActions({});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load payroll';
      setLoadError(msg);
      reportError(e, { source: 'PayrollPage.load', month });
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRowAction = (userId: string, patch: Partial<RowActionState>) => {
    setRowActions((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? idleRowAction), ...patch },
    }));
  };

  const openDeduct = (employee: PayrollEmployeeRow) => {
    setDeductTarget(employee);
    setDeductAmount(employee.deduction > 0 ? String(employee.deduction) : '');
    setDeductError(null);
  };

  const closeDeduct = () => {
    if (deductSaving) {
      return;
    }
    setDeductTarget(null);
    setDeductAmount('');
    setDeductError(null);
  };

  const submitDeduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductTarget) {
      return;
    }
    setDeductSaving(true);
    setDeductError(null);
    try {
      const res = await fetch(`/api/payroll/${encodeURIComponent(deductTarget.user_id)}/deduct`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: deductAmount.trim() || '0', month }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to save deduction');
      }
      setDeductTarget(null);
      setDeductAmount('');
      await load();
      updateRowAction(deductTarget.user_id, {
        message:
          body?.deduction > 0
            ? `Deduction saved. Net pay for ${monthLabel}: ${formatEmployeeSalary(body.net_salary)}.`
            : `Deduction cleared for ${monthLabel}.`,
        error: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save deduction';
      setDeductError(msg);
      reportError(err, { source: 'PayrollPage.submitDeduct', userId: deductTarget.user_id, month });
    } finally {
      setDeductSaving(false);
    }
  };

  const downloadReceipt = async (userId: string) => {
    updateRowAction(userId, { downloading: true, error: null, message: null });
    try {
      const res = await fetch(
        `/api/payroll/${encodeURIComponent(userId)}/receipt?month=${encodeURIComponent(month)}`,
        { credentials: 'include' },
      );
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
      reportError(e, { source: 'PayrollPage.downloadReceipt', userId, month });
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to send receipt');
      }
      updateRowAction(userId, { message: typeof body?.message === 'string' ? body.message : 'Receipt sent.' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send receipt';
      updateRowAction(userId, { error: msg });
      reportError(e, { source: 'PayrollPage.sendReceipt', userId, month });
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
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[180px] text-center">
            <p className="text-lg font-semibold text-slate-900">{monthLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setMonth((current) => shiftMonth(current, 1))}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

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
                const hasSalary = employee.salary != null && employee.salary > 0;
                const salaryLabel =
                  employee.deduction > 0
                    ? `${formatEmployeeSalary(employee.net_salary)} net`
                    : formatEmployeeSalary(employee.salary);

                return (
                  <li key={employee.user_id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <button
                            type="button"
                            onClick={() => openDeduct(employee)}
                            disabled={!hasSalary}
                            title={
                              hasSalary
                                ? `Deduct salary for ${monthLabel}`
                                : 'Set a salary on the profile first'
                            }
                            className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <MinusCircle className="h-3.5 w-3.5" aria-hidden />
                            Deduct salary
                          </button>
                          <button
                            type="button"
                            onClick={() => openEmployee(employee.user_id)}
                            aria-label={`View profile for ${displayName}`}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 -m-1 p-1"
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
                              {employee.deduction > 0 && (
                                <p className="mt-0.5 text-xs text-amber-800">
                                  Deducted {formatEmployeeSalary(employee.deduction)} in {monthLabel}
                                  {employee.salary != null
                                    ? ` (base ${formatEmployeeSalary(employee.salary)})`
                                    : ''}
                                </p>
                              )}
                            </div>
                          </button>
                          <p className="shrink-0 text-sm font-semibold text-slate-900 sm:hidden">{salaryLabel}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <p className="hidden text-sm font-semibold text-slate-900 sm:mr-2 sm:block">{salaryLabel}</p>
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

      {deductTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Deduct salary</h3>
            <p className="mt-1 text-sm text-slate-500">
              For{' '}
              {employeeFullName(deductTarget.display_name, deductTarget.surname, deductTarget.email)}{' '}
              — {monthLabel} only. Profile salary stays {formatEmployeeSalary(deductTarget.salary)}.
              Leave 0 to clear the deduction.
            </p>
            <form onSubmit={(e) => void submitDeduct(e)} className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Deduction amount (PKR)</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  max={deductTarget.salary ?? undefined}
                  value={deductAmount}
                  onChange={(e) => setDeductAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. 4000"
                  autoFocus
                />
              </label>
              {deductAmount &&
                deductTarget.salary != null &&
                Number(deductAmount) >= 0 &&
                Number.isFinite(Number(deductAmount)) && (
                  <p className="text-sm text-slate-600">
                    Net for {monthLabel}:{' '}
                    <span className="font-semibold text-slate-900">
                      {formatEmployeeSalary(
                        Math.max(0, deductTarget.salary - (Number(deductAmount) || 0)),
                      )}
                    </span>
                  </p>
                )}
              {deductError && <p className="text-sm text-red-600">{deductError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDeduct}
                  disabled={deductSaving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <OutlineFillButtonAction type="submit" disabled={deductSaving}>
                  {deductSaving ? 'Saving…' : 'Save deduction'}
                </OutlineFillButtonAction>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
