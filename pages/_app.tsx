import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { Inter, Sora } from 'next/font/google';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import ConnectionProvider from '@/components/ConnectionProvider';
import RouteNavigationProvider from '@/components/RouteNavigationProvider';
import SkyenSplashScreen from '@/components/SkyenSplashScreen';
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
  const [splashTrigger, setSplashTrigger] = useState(0);
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add(inter.variable, sora.variable);
    return () => {
      document.documentElement.classList.remove(inter.variable, sora.variable);
    };
  }, []);

  // Show splash whenever user:
  // 1) opens an already-authenticated session, or
  // 2) logs in (route change from /login → any non-/login page).
  useEffect(() => {
    const currentPath = router.pathname;
    const prevPath = prevPathRef.current;

    if (prevPath === null) {
      prevPathRef.current = currentPath;
      if (currentPath !== '/login') {
        setSplashTrigger((v) => v + 1);
      }
      return;
    }

    if (prevPath === '/login' && currentPath !== '/login') {
      setSplashTrigger((v) => v + 1);
    }

    prevPathRef.current = currentPath;
  }, [router.pathname]);

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
        <SkyenSplashScreen shouldShow={router.pathname !== '/login'} triggerKey={splashTrigger} />
        <ConnectionProvider>
          <RouteNavigationProvider>
            <Component {...pageProps} />
          </RouteNavigationProvider>
        </ConnectionProvider>
      </div>
    </AppErrorBoundary>
  );
}
