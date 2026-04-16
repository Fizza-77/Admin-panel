import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { reportError } from '@/lib/monitoring';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

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
      <Component {...pageProps} />
    </AppErrorBoundary>
  );
}
