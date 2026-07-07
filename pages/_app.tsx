import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Inter, Sora } from 'next/font/google';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import ConnectionProvider from '@/components/ConnectionProvider';
import RouteNavigationProvider from '@/components/RouteNavigationProvider';
import { reportError } from '@/lib/monitoring';
import { startAdminSessionMaintenance } from '@/lib/auth/clientSession';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    document.documentElement.classList.add(inter.variable, sora.variable);
    return () => {
      document.documentElement.classList.remove(inter.variable, sora.variable);
    };
  }, []);

  useEffect(() => {
    return startAdminSessionMaintenance(router.pathname === '/login');
  }, [router.pathname]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      reportError(new Error('Missing required public Supabase environment variables'), {
        source: '_app.publicEnvValidation',
      });
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportError(event.reason, {
        source: 'unhandledrejection',
        route: router.asPath,
      });
    };

    const onWindowError = (event: ErrorEvent) => {
      reportError(event.error ?? event.message, {
        source: 'window.onerror',
        route: router.asPath,
      });
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError);
    };
  }, [router.asPath]);

  return (
    <AppErrorBoundary>
      <div className={`${inter.variable} ${sora.variable} font-sans`}>
      <ConnectionProvider>
      <RouteNavigationProvider>
        <Component {...pageProps} />
      </RouteNavigationProvider>
      </ConnectionProvider>
      </div>
    </AppErrorBoundary>
  );
}
