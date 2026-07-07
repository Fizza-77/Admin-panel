'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/router';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { RouteNavigationContext } from '@/lib/ui/routeNavigation';
import { getRouteLoadingMessages } from '@/lib/ui/loadingMessages';
import { clearLoggingOut, peekLoggingOut } from '@/lib/client/adminSession';

function routePath(url: string) {
  return url.split('?')[0].split('#')[0];
}

/** Shows a full-screen spinner only while Next.js is fetching/rendering the next page. */
export default function RouteNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadingMessages = useMemo(
    () => getRouteLoadingMessages(pendingUrl, { loggingOut }),
    [pendingUrl, loggingOut],
  );

  useEffect(() => {
    const onStart = (url: string, { shallow }: { shallow: boolean }) => {
      if (shallow) {
        return;
      }
      if (routePath(router.asPath) === routePath(url)) {
        return;
      }
      setPendingUrl(url);
      setLoggingOut(routePath(url) === '/login' && peekLoggingOut());
      setIsNavigating(true);
    };

    const onDone = () => {
      clearLoggingOut();
      flushSync(() => {
        setIsNavigating(false);
        setPendingUrl(null);
        setLoggingOut(false);
      });
    };

    router.events.on('routeChangeStart', onStart);
    router.events.on('routeChangeComplete', onDone);
    router.events.on('routeChangeError', onDone);

    return () => {
      router.events.off('routeChangeStart', onStart);
      router.events.off('routeChangeComplete', onDone);
      router.events.off('routeChangeError', onDone);
    };
  }, [router]);

  return (
    <RouteNavigationContext.Provider value={{ isNavigating }}>
      {isNavigating ? <LoadingOverlay messages={loadingMessages} rotateIntervalMs={3200} /> : null}
      {children}
    </RouteNavigationContext.Provider>
  );
}
