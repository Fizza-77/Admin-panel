import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { AppPermissions } from '@/lib/permissions/types';
import { Trash2, UserPlus } from 'lucide-react';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import { useRouteNavigation } from '@/lib/ui/routeNavigation';
import { format } from 'date-fns';
import { reportError } from '@/lib/monitoring';

export type AdminUserRow = {
  id: string;
  email: string | undefined;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  can_manage_blogs: boolean;
  can_manage_tasks: boolean;
  can_administer_tasks: boolean;
  can_manage_users: boolean;
  can_manage_attendance: boolean;
  can_manage_expenses: boolean;
  can_manage_profiles: boolean;
  can_manage_payroll: boolean;
};

export const getServerSideProps = requireAuthentication(
  requirePermission({ users: true }, async () => ({ props: {} })),
);

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return format(d, 'MMM d, yyyy HH:mm');
  } catch {
    return '—';
  }
}

const USERS_PAGE_SIZE = 50;

export default function AdminUsersPage({ permissions }: { permissions: AppPermissions }) {
  const { isNavigating } = useRouteNavigation();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newBlogs, setNewBlogs] = useState(true);
  const [newTaskAdmin, setNewTaskAdmin] = useState(false);
  const [newAttendanceControl, setNewAttendanceControl] = useState(false);
  const [newExpenseTracker, setNewExpenseTracker] = useState(false);
  const [newSetProfiles, setNewSetProfiles] = useState(false);
  const [newPayroll, setNewPayroll] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');

  const isPrimaryOwnerRow = (row: AdminUserRow) =>
    permissions.isPrimaryAdmin &&
    row.email?.trim().toLowerCase() === permissions.accountEmail?.trim().toLowerCase();

  const load = useCallback(async (pageNum: number) => {
    setLoadError(null);
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('page', String(pageNum));
      q.set('per_page', String(USERS_PAGE_SIZE));
      const res = await fetch(`/api/admin/users?${q.toString()}`, { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof body?.detail === 'string' ? body.detail : null;
        throw new Error(
          detail ? `${body?.message || 'Failed to load users'}: ${detail}` : body?.message || 'Failed to load users',
        );
      }
      setUsers(Array.isArray(body?.users) ? body.users : []);
      setPage(typeof body?.page === 'number' ? body.page : pageNum);
      setHasNextPage(Boolean(body?.hasNextPage));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load users';
      setLoadError(msg);
      reportError(e, { source: 'AdminUsersPage.load' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const updateLocalRow = (id: string, patch: Partial<AdminUserRow>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  };

  const saveRow = async (row: AdminUserRow) => {
    setSavingId(row.id);
    try {
      const res = await fetch(`/api/admin/users/${row.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          can_manage_blogs: row.can_manage_blogs,
          can_administer_tasks: row.can_administer_tasks,
          can_manage_users: row.can_manage_users,
          can_manage_attendance: row.can_manage_attendance,
          can_manage_expenses: row.can_manage_expenses,
          can_manage_profiles: row.can_manage_profiles,
          can_manage_payroll: row.can_manage_payroll,
          display_name: (row.display_name ?? '').trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Save failed');
      }
      await load(page);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      alert(msg);
      reportError(e, { source: 'AdminUsersPage.saveRow', userId: row.id });
    } finally {
      setSavingId(null);
    }
  };

  const deleteRow = async (row: AdminUserRow) => {
    if (!permissions.isPrimaryAdmin) {
      alert('Only ADMIN_OWNER_EMAIL can delete users.');
      return;
    }

    const confirmed = window.confirm(`Delete user "${row.email ?? 'unknown'}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/admin/users/${row.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Delete failed');
      }
      await load(page);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      alert(msg);
      reportError(e, { source: 'AdminUsersPage.deleteRow', userId: row.id });
    } finally {
      setDeletingId(null);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          display_name: newDisplayName.trim() || null,
          can_manage_blogs: newBlogs,
          can_administer_tasks: newTaskAdmin,
          can_manage_attendance: newAttendanceControl,
          can_manage_expenses: newExpenseTracker,
          can_manage_profiles: newSetProfiles,
          can_manage_payroll: newPayroll,
          can_manage_users: false,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof body?.detail === 'string' ? body.detail : '';
        throw new Error(detail ? `${body?.message || 'Could not create user'} (${detail})` : body?.message || 'Could not create user');
      }
      setNewEmail('');
      setNewPassword('');
      setNewBlogs(true);
      setNewTaskAdmin(false);
      setNewAttendanceControl(false);
      setNewExpenseTracker(false);
      setNewSetProfiles(false);
      setNewPayroll(false);
      setNewDisplayName('');
      setPage(1);
      await load(1);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Could not create user');
      reportError(err, { source: 'AdminUsersPage.createUser' });
    } finally {
      setCreating(false);
    }
  };

  const overlayMessages =
    creating ? ['Creating user…', 'Setting up account access…', 'Almost done…']
    : savingId ? ['Saving user…', 'Updating permissions…', 'Almost done…']
    : deletingId ? ['Deleting user…', 'Removing access…', 'Almost done…']
    : loading ? ['Loading users…', 'Fetching team accounts…', 'Almost ready…']
    : null;

  return (
    <AdminLayout permissions={permissions}>
      {overlayMessages && !isNavigating && (
        <LoadingOverlay messages={overlayMessages} rotateIntervalMs={3000} />
      )}
      <Head>
        <title>User management - Skyen Admin</title>
      </Head>

      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User management</h1>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-cyan-600" aria-hidden />
            Add user
          </h2>
          <form onSubmit={createUser} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-700">Initial password (min 8 characters)</span>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                autoComplete="new-password"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-700">Email</span>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                autoComplete="off"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-700">Display name (optional)</span>
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Shown in tasks and header"
              />
            </label>
            <div className="flex flex-wrap gap-4 sm:col-span-2 lg:col-span-4 items-center">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newBlogs} onChange={(e) => setNewBlogs(e.target.checked)} />
                Blogs
              </label>
              <label
                className="inline-flex items-center gap-2 text-sm"
                title="Create tasks, edit any task, assign anyone, manage tags"
              >
                <input type="checkbox" checked={newTaskAdmin} onChange={(e) => setNewTaskAdmin(e.target.checked)} />
                Tasks admin
              </label>
              <label
                className="inline-flex items-center gap-2 text-sm"
                title="Mark daily attendance for all team members"
              >
                <input
                  type="checkbox"
                  checked={newAttendanceControl}
                  onChange={(e) => setNewAttendanceControl(e.target.checked)}
                />
                Attendance control
              </label>
              <label
                className="inline-flex items-center gap-2 text-sm"
                title="Record and view team expenses"
              >
                <input
                  type="checkbox"
                  checked={newExpenseTracker}
                  onChange={(e) => setNewExpenseTracker(e.target.checked)}
                />
                Expense tracker
              </label>
              <label
                className="inline-flex items-center gap-2 text-sm"
                title="Open All Employees and edit employee profile fields"
              >
                <input
                  type="checkbox"
                  checked={newSetProfiles}
                  onChange={(e) => setNewSetProfiles(e.target.checked)}
                />
                Set profiles
              </label>
              <label
                className="inline-flex items-center gap-2 text-sm"
                title="Access Payroll (independent of attendance)"
              >
                <input
                  type="checkbox"
                  checked={newPayroll}
                  onChange={(e) => setNewPayroll(e.target.checked)}
                />
                Payroll
              </label>
              <span className="text-xs text-slate-500 sm:col-span-2 lg:col-span-4">
                Basic task access is enabled for all new users.
              </span>
            </div>
            {formError && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-4">{formError}</p>}
            <div className="sm:col-span-2 lg:col-span-4">
              <OutlineFillButtonAction type="submit" disabled={creating} icon={<UserPlus className="h-[15px] w-[15px]" aria-hidden />}>
                Create user
              </OutlineFillButtonAction>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">All users</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                Page {page}
                {hasNextPage ? ' · more on next page' : ''}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => void load(page - 1)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={!hasNextPage || loading}
                  onClick={() => void load(page + 1)}
                  className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
              <button
                type="button"
                onClick={() => void load(page)}
                className="text-sm font-medium text-cyan-700 hover:text-cyan-800"
              >
                Refresh
              </button>
            </div>
          </div>
          {loadError ? (
            <p className="p-5 text-red-600">{loadError}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Display name</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Created</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Last sign-in</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Blogs</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700" title="Manage all tasks">
                      Tasks admin
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700" title="Mark attendance for everyone">
                      Attendance control
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700" title="Record and view team expenses">
                      Expense tracker
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700" title="Edit employee profiles">
                      Set profiles
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700" title="Access Payroll">
                      Payroll
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((row) => {
                    const primaryLocked = isPrimaryOwnerRow(row);
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-slate-900">
                          {row.email ?? '—'}
                          {primaryLocked && (
                            <span className="ml-2 text-[10px] font-semibold uppercase text-cyan-700">Primary admin</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-800">
                          <input
                            type="text"
                            value={row.display_name ?? ''}
                            onChange={(e) => updateLocalRow(row.id, { display_name: e.target.value || null })}
                            maxLength={120}
                            className="w-full min-w-[140px] rounded border border-slate-200 px-2 py-1 text-sm"
                            placeholder="Name"
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDt(row.created_at)}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDt(row.last_sign_in_at)}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={primaryLocked ? true : row.can_manage_blogs}
                            disabled={primaryLocked}
                            onChange={(e) => updateLocalRow(row.id, { can_manage_blogs: e.target.checked })}
                            aria-label="Can manage blogs"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={primaryLocked ? true : row.can_administer_tasks}
                            disabled={primaryLocked}
                            onChange={(e) => updateLocalRow(row.id, { can_administer_tasks: e.target.checked })}
                            aria-label="Tasks admin — create and manage all tasks"
                            title="Tasks admin: create tasks, edit any task, manage tags"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={primaryLocked ? true : row.can_manage_attendance}
                            disabled={primaryLocked}
                            onChange={(e) => updateLocalRow(row.id, { can_manage_attendance: e.target.checked })}
                            aria-label="Attendance control — mark attendance for everyone"
                            title="Attendance control: mark daily attendance for all team members"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={primaryLocked ? true : row.can_manage_expenses}
                            disabled={primaryLocked}
                            onChange={(e) => updateLocalRow(row.id, { can_manage_expenses: e.target.checked })}
                            aria-label="Expense tracker — record and view team expenses"
                            title="Expense tracker: record and view team expenses"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={primaryLocked ? true : row.can_manage_profiles}
                            disabled={primaryLocked}
                            onChange={(e) => updateLocalRow(row.id, { can_manage_profiles: e.target.checked })}
                            aria-label="Set profiles — edit employee profile fields"
                            title="Set profiles: open All Employees and edit employee profile fields"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={primaryLocked ? true : row.can_manage_payroll}
                            disabled={primaryLocked}
                            onChange={(e) => updateLocalRow(row.id, { can_manage_payroll: e.target.checked })}
                            aria-label="Payroll — access payroll"
                            title="Payroll: access salary receipts (independent of attendance)"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <OutlineFillButtonAction
                              type="button"
                              onClick={() => void saveRow(row)}
                              disabled={savingId === row.id || deletingId === row.id}
                              className="!text-xs !min-h-8"
                            >
                              {savingId === row.id ? 'Saving…' : 'Save'}
                            </OutlineFillButtonAction>
                            <button
                              type="button"
                              onClick={() => void deleteRow(row)}
                              disabled={
                                deletingId === row.id ||
                                savingId === row.id ||
                                !permissions.isPrimaryAdmin ||
                                primaryLocked
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {users.length === 0 && <p className="p-6 text-slate-500">No users returned.</p>}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
