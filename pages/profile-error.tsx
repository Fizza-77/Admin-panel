import Head from 'next/head';
import Link from 'next/link';
import { getAuthUserFromGsspContext, requireAuthentication } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import DataLoadError from '@/components/ui/DataLoadError';
import type { AppPermissions } from '@/lib/permissions/types';
import type { GetServerSidePropsContext } from 'next';
import { getAppProfile } from '@/lib/permissions/getAppProfile';

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
  const user = await getAuthUserFromGsspContext(context);
  if (!user) {
    return { redirect: { destination: '/login', permanent: false } };
  }

  const q = context.query.message;
  const fromQuery = typeof q === 'string' ? decodeURIComponent(q) : null;
  const { permissions } = await getAppProfile(user.id, user.email);
  const message = fromQuery || permissions.profileLoadError || 'Could not load your access profile from the database.';

  return {
    props: {
      permissions,
      message,
    },
  };
});

export default function ProfileErrorPage({
  permissions,
  message,
}: {
  permissions: AppPermissions;
  message: string;
}) {
  return (
    <AdminLayout permissions={permissions}>
      <Head>
        <title>Profile error - Skyen Admin</title>
      </Head>
      <div className="mx-auto max-w-2xl space-y-6">
        <DataLoadError
          title="Access profile could not be loaded"
          message="You are signed in, but the admin panel could not read or create your permission profile in the database. This is not the same as having no permissions."
          detail={message}
        />
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 space-y-3">
          <p className="font-medium text-slate-900">What to try</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Confirm production migrations have been applied (especially `app_profiles` and `can_administer_tasks`).</li>
            <li>Run the SQL diagnostics in `supabase/diagnostics/production_checks.sql`.</li>
            <li>Check `/api/health` and `/api/debug/permissions` (admin only).</li>
            <li>Sign out and sign in again after the database is fixed.</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
          >
            Sign in again
          </Link>
          {permissions.canAccessUserManagement && (
            <Link
              href="/admin/users"
              className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              User management
            </Link>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
