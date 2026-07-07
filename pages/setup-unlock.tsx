import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Lock } from 'lucide-react';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import { requireAuthentication, requirePermission, resolveSetupUnlockGate } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { GetServerSideProps, GetServerSidePropsContext } from 'next';
import { reportError } from '@/lib/monitoring';
import type { AppPermissions } from '@/lib/permissions/types';

interface SetupUnlockPageProps {
  returnUrl?: string;
  permissions: AppPermissions;
}

// ✅ Fix: explicitly type the exported getServerSideProps
export const getServerSideProps: GetServerSideProps = requireAuthentication(
  requirePermission({ blogs: true }, async (context: GetServerSidePropsContext) => {
    return resolveSetupUnlockGate(context);
  }),
);

export default function SetupUnlockPage({ returnUrl: returnUrlProp, permissions }: SetupUnlockPageProps) {
  const router = useRouter();
  const returnUrl =
    returnUrlProp ?? (typeof router.query.returnUrl === 'string' ? router.query.returnUrl : '/');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/setup-unlock', { password }, { withCredentials: true });
      const dest = returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/';
      await router.replace(dest);
    } catch (err: any) {
      reportError(err, { source: 'SetupUnlockPage.onSubmit', returnUrl: destOrFallback(returnUrl) });
      setError(err.response?.data?.message || 'Could not verify password');
    } finally {
      setLoading(false);
    }
  };

  function destOrFallback(value: string): string {
    return value.startsWith('/') && !value.startsWith('//') ? value : '/';
  }

  return (
    <AdminLayout permissions={permissions}>
      {loading && <LoadingOverlay label="Unlocking…" />}
      <Head>
        <title>Setup password - Blog Admin</title>
      </Head>
      <div className="w-full max-w-md mx-auto min-h-[70vh] flex flex-col justify-center px-1 sm:px-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Additional password required</h1>
        <p className="text-sm text-gray-600 mt-2">
          Enter the setup password to manage connected sites, site setup, and new blog posts. This is configured with{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">ADMIN_SETUP_PASSWORD</code> on the server.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4 bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Setup password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 border border-gray-300 rounded-lg py-3 text-sm"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          </div>
          <OutlineFillButtonAction type="submit" disabled={loading} className="!w-full">
            Continue
          </OutlineFillButtonAction>
        </form>
      </div>
    </AdminLayout>
  );
}