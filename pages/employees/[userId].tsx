import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { AppPermissions } from '@/lib/permissions/types';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
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
import type { AttendanceRecordSlice } from '@/lib/attendance/reports';
import type { AttendanceStatus } from '@/lib/attendance/types';
import {
  employeeFullName,
  formatEmployeeSalary,
  type EmployeeProfile,
} from '@/lib/employees/profile';

export const getServerSideProps = requireAuthentication(
  requirePermission({ attendance: true }, async () => ({ props: {} })),
);

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export default function EmployeeDetailPage({ permissions }: { permissions: AppPermissions }) {
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

  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [companyRole, setCompanyRole] = useState('');
  const [salary, setSalary] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [monthFrom, setMonthFrom] = useState<string | null>(null);
  const [monthTo, setMonthTo] = useState<string | null>(null);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecordSlice[]>([]);
  const [yearLeaveRecords, setYearLeaveRecords] = useState<AttendanceRecordSlice[]>([]);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      return;
    }
    setProfileError(null);
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(userId)}`, { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load employee');
      }
      const profile = body.employee as EmployeeProfile;
      setEmployee(profile);
      setCompanyRole(profile.company_role ?? '');
      setSalary(profile.salary != null ? String(profile.salary) : '');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load employee';
      setProfileError(msg);
      reportError(e, { source: 'EmployeeDetailPage.loadProfile', userId });
    } finally {
      setProfileLoading(false);
    }
  }, [userId]);

  const loadReports = useCallback(
    async (targetMonth: string) => {
      if (!userId) {
        return;
      }
      setReportsError(null);
      setReportsLoading(true);
      try {
        const res = await fetch(
          `/api/attendance/users/${encodeURIComponent(userId)}?month=${encodeURIComponent(targetMonth)}`,
          { credentials: 'include' },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.message || 'Failed to load attendance');
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
        const msg = e instanceof Error ? e.message : 'Failed to load attendance';
        setReportsError(msg);
        reportError(e, { source: 'EmployeeDetailPage.loadReports', userId, month: targetMonth });
      } finally {
        setReportsLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    void loadReports(month);
  }, [loadReports, month, userId]);

  const saveAdminFields = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      return;
    }
    setAdminMessage(null);
    setAdminError(null);
    setAdminSaving(true);
    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_role: companyRole.trim() || null,
          salary: salary.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to save');
      }
      const profile = body.employee as EmployeeProfile;
      setEmployee(profile);
      setCompanyRole(profile.company_role ?? '');
      setSalary(profile.salary != null ? String(profile.salary) : '');
      setAdminMessage('Role and salary saved.');
    } catch (err: unknown) {
      setAdminError(err instanceof Error ? err.message : 'Failed to save');
      reportError(err, { source: 'EmployeeDetailPage.saveAdminFields', userId });
    } finally {
      setAdminSaving(false);
    }
  };

  const fullName = employee
    ? employeeFullName(employee.display_name, employee.surname, employee.email)
    : 'Employee';

  const overlayMessages =
    profileLoading ? ['Loading employee…', 'Fetching profile details…']
    : adminSaving ? ['Saving role and salary…', 'Updating employee record…']
    : reportsLoading ? ['Loading attendance…', 'Fetching reports…']
    : null;

  return (
    <AdminLayout permissions={permissions}>
      {overlayMessages && <LoadingOverlay messages={overlayMessages} rotateIntervalMs={2800} />}
      <Head>
        <title>{fullName} - Skyen Admin</title>
      </Head>

      <div className="relative mx-auto w-full max-w-4xl space-y-4">
        {profileError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{profileError}</p>
        ) : employee ? (
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-5 sm:px-6">
              <div className="flex items-start gap-4">
                <UserAvatar
                  label={userDisplayLabel(employee.display_name, employee.email, employee.surname)}
                  avatarUrl={employee.avatar_url}
                  size="lg"
                />
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold text-slate-900">{fullName}</h1>
                  <p className="mt-0.5 text-sm text-slate-500">{employee.email ?? '—'}</p>
                </div>
              </div>
            </div>

            <dl className="grid gap-4 border-b border-slate-100 px-4 py-5 sm:grid-cols-2 sm:px-6">
              <DetailItem label="First name" value={employee.display_name?.trim() || '—'} />
              <DetailItem label="Surname" value={employee.surname?.trim() || '—'} />
              <DetailItem label="Qualification" value={employee.qualification?.trim() || '—'} />
              <DetailItem label="Contact info" value={employee.contact_info?.trim() || '—'} />
              <DetailItem label="Role in company" value={employee.company_role?.trim() || '—'} />
              <DetailItem label="Salary" value={formatEmployeeSalary(employee.salary)} />
            </dl>

            <form onSubmit={(e) => void saveAdminFields(e)} className="space-y-4 bg-slate-50/80 px-4 py-5 sm:px-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Admin settings</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Set this employee&apos;s role and salary. Personal details are managed by the employee in Profile.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Role in company</span>
                  <input
                    type="text"
                    value={companyRole}
                    onChange={(e) => setCompanyRole(e.target.value)}
                    maxLength={120}
                    placeholder="e.g. Senior Developer"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Salary (PKR / month)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder="e.g. 150000"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
              {adminError && <p className="text-sm text-red-600">{adminError}</p>}
              {adminMessage && <p className="text-sm text-emerald-700">{adminMessage}</p>}
              <OutlineFillButtonAction type="submit" disabled={adminSaving}>
                {adminSaving ? 'Saving…' : 'Save role & salary'}
              </OutlineFillButtonAction>
            </form>
          </section>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-slate-900">Attendance</h2>
            <p className="text-sm text-slate-500">{monthLabel}</p>
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

          {reportsError ? (
            <p className="p-5 text-red-600">{reportsError}</p>
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
