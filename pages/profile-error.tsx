import Head from 'next/head';
import Link from 'next/link';
import { requireAuthentication } from '@/lib/auth';
import { resolveAdminUserContextFromGssp } from '@/lib/auth/resolveUserContext';
import AdminLayout from '@/components/Layout/AdminLayout';
import DataLoadError from '@/components/ui/DataLoadError';
import type { AppPermissions } from '@/lib/permissions/types';
import type { GetServerSidePropsContext } from 'next';

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
  const ctx = await resolveAdminUserContextFromGssp(context);
  if (!ctx) {
    return { redirect: { destination: '/login', permanent: false } };
  }

  const q = context.query.message;
  const fromQuery = typeof q === 'string' ? decodeURIComponent(q) : null;
  const message =
    fromQuery || ctx.profileLoadError || 'Could not load your access profile from the database.';

  return {
    props: {
      permissions: ctx.permissions,
      message,
    },
  };
});

function isRlsMessage(message: string): boolean {
  return /row-level security|42501/i.test(message);
}

export default function ProfileErrorPage({
  permissions,
  message,
}: {
  permissions: AppPermissions;
  message: string;
}) {
  const rlsIssue = isRlsMessage(message);

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
        {rlsIssue && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 space-y-2">
            <p className="font-semibold">Server configuration issue (not your account)</p>
            <p>
              Production is almost certainly using the <strong>anon/public</strong> Supabase key as{' '}
              <code className="rounded bg-amber-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>. Localhost works because{' '}
              <code className="rounded bg-amber-100 px-1">.env.local</code> has the correct service role secret.
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Supabase Dashboard → Project Settings → API → copy the <strong>service_role</strong> secret (not anon).
              </li>
              <li>
                Set <code className="rounded bg-amber-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code> in PM2 / server env.
              </li>
              <li>
                Run <code className="rounded bg-amber-100 px-1">pm2 restart admin-panel --update-env</code>
              </li>
              <li>
                Open <code className="rounded bg-amber-100 px-1">/api/health</code> —{' '}
                <code className="rounded bg-amber-100 px-1">service_role_key.valid</code> must be{' '}
                <code className="rounded bg-amber-100 px-1">true</code>.
              </li>
            </ol>
          </div>
        )}
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 space-y-3">
          <p className="font-medium text-slate-900">What to try</p>
          <ul className="list-disc pl-5 space-y-1">
            {!rlsIssue && (
              <li>Confirm production migrations have been applied (especially `app_profiles` and `can_administer_tasks`).</li>
            )}
            <li>Run the SQL diagnostics in `supabase/diagnostics/production_checks.sql`.</li>
            <li>Check `/api/health` — look at `service_role_key` and `app_profiles_write_probe`.</li>
            <li>Sign out and sign in again after the server environment is fixed.</li>
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
