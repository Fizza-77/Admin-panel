import Head from 'next/head';
import { useCallback, useEffect, useState } from 'react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { AppPermissions } from '@/lib/permissions/types';
import { Loader2, UserPlus } from 'lucide-react';
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
  can_manage_users: boolean;
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
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newBlogs, setNewBlogs] = useState(true);
  const [newTasks, setNewTasks] = useState(false);
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
        throw new Error(body?.message || 'Failed to load users');
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
          can_manage_tasks: row.can_manage_tasks,
          can_manage_users: row.can_manage_users,
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
          can_manage_tasks: newTasks,
          can_manage_users: false,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Could not create user');
      }
      setNewEmail('');
      setNewPassword('');
      setNewBlogs(true);
      setNewTasks(false);
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

  return (
    <AdminLayout permissions={permissions}>
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
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newTasks} onChange={(e) => setNewTasks(e.target.checked)} />
                Tasks
              </label>
            </div>
            {formError && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-4">{formError}</p>}
            <div className="sm:col-span-2 lg:col-span-4">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create user
              </button>
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
          {loading ? (
            <div className="flex justify-center py-16 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : loadError ? (
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
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Tasks</th>
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
                            checked={row.can_manage_blogs}
                            disabled={primaryLocked}
                            onChange={(e) => updateLocalRow(row.id, { can_manage_blogs: e.target.checked })}
                            aria-label="Can manage blogs"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.can_manage_tasks}
                            disabled={primaryLocked}
                            onChange={(e) => updateLocalRow(row.id, { can_manage_tasks: e.target.checked })}
                            aria-label="Can manage tasks"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void saveRow(row)}
                            disabled={savingId === row.id}
                            className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-900 hover:bg-cyan-100 disabled:opacity-50"
                          >
                            {savingId === row.id ? 'Saving…' : 'Save'}
                          </button>
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
