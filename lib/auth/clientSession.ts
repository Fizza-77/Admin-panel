const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export async function refreshAdminSession(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Periodically refresh session cookies while the user has the admin open. */
export function startAdminSessionMaintenance(isLoginPage: boolean): () => void {
  if (typeof window === 'undefined' || isLoginPage) {
    return () => {};
  }

  const tick = () => {
    void refreshAdminSession();
  };

  tick();
  refreshTimer = setInterval(tick, REFRESH_INTERVAL_MS);

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      tick();
    }
  };

  window.addEventListener('focus', tick);
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    window.removeEventListener('focus', tick);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
