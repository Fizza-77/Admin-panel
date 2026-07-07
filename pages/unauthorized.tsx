import Head from 'next/head';
import { requireAuthentication } from '@/lib/auth';
import { resolveAdminUserContextFromGssp } from '@/lib/auth/resolveUserContext';
import AdminLayout from '@/components/Layout/AdminLayout';
import OutlineFillButton from '@/components/ui/OutlineFillButton';
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
            <OutlineFillButton href="/admin/users" className="ui-outline-fill-btn--auto">
              User management
            </OutlineFillButton>
          )}
          {permissions.canManageBlogs && (
            <OutlineFillButton href="/" className="ui-outline-fill-btn--auto">
              Blog dashboard
            </OutlineFillButton>
          )}
          {permissions.canManageTasks && (
            <OutlineFillButton href="/tasks" className="ui-outline-fill-btn--auto">
              Tasks
            </OutlineFillButton>
          )}
          <OutlineFillButton href="/settings" className="ui-outline-fill-btn--auto">
            Profile settings
          </OutlineFillButton>
          <OutlineFillButton href="/login" className="ui-outline-fill-btn--auto">
            Sign in again
          </OutlineFillButton>
        </div>
      </div>
    </AdminLayout>
  );
}
