import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Lock, Loader2 } from 'lucide-react';
import { requireAuthentication, resolveSetupUnlockGate } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { GetServerSidePropsContext } from 'next';

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
  return resolveSetupUnlockGate(context);
});

interface SetupUnlockPageProps {
  returnUrl?: string;
}

export default function SetupUnlockPage({ returnUrl: returnUrlProp }: SetupUnlockPageProps) {
  const router = useRouter();
  const returnUrl =
    returnUrlProp ??
    (typeof router.query.returnUrl === 'string' ? router.query.returnUrl : '/');
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
      setError(err.response?.data?.message || 'Could not verify password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <Head>
        <title>Setup password - Blog Admin</title>
      </Head>
      <div className="max-w-md mx-auto mt-6 sm:mt-12 px-1 sm:px-0">
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
                className="block w-full pl-10 border border-gray-300 rounded-lg py-2.5 text-sm"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Continue
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
