import Head from 'next/head';
import Link from 'next/link';
import { requireAuthentication } from '@/lib/auth';
import { resolveAdminUserContextFromGssp } from '@/lib/auth/resolveUserContext';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { AppPermissions } from '@/lib/permissions/types';
import type { GetServerSidePropsContext } from 'next';

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
  const ctx = await resolveAdminUserContextFromGssp(context);
  if (!ctx) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: { permissions: ctx.permissions } };
});

export default function UnauthorizedPage({ permissions }: { permissions: AppPermissions }) {
  return (
    <AdminLayout permissions={permissions}>
      <Head>
        <title>Access restricted - Skyen Admin</title>
      </Head>
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-6 shadow-sm max-w-lg">
        <h1 className="text-lg font-semibold text-slate-900">No access yet</h1>
        <p className="mt-2 text-slate-700">
          {permissions.profileLoadError
            ? 'You are signed in, but your access profile could not be loaded from the database. This is different from having no permissions — an administrator should check migrations and /api/health.'
            : 'You are signed in, but your account does not have permission to use the blog or task areas yet. Ask an admin to grant access, or open user management if you administer accounts.'}
        </p>
        {permissions.profileLoadError && (
          <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 font-mono break-all">
            {permissions.profileLoadError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {permissions.canAccessUserManagement && (
            <Link
              href="/admin/users"
              className="inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            >
              User management
            </Link>
          )}
          {permissions.canManageBlogs && (
            <Link
              href="/"
              className="inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            >
              Blog dashboard
            </Link>
          )}
          {permissions.canManageTasks && (
            <Link
              href="/tasks"
              className="inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            >
              Tasks
            </Link>
          )}
          <Link href="/settings" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Profile settings
          </Link>
          <Link href="/login" className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Sign in again
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
