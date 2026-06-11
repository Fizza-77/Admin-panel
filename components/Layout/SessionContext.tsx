'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  clearAdminClientSession,
  pickBestPermissions,
  readAdminClientSession,
  saveAdminClientSession,
  type AdminClientSession,
} from '@/lib/client/adminSession';
import type { AppPermissions } from '@/lib/permissions/types';
import { reportError } from '@/lib/monitoring';

type SessionContextValue = {
  userId: string | null;
  email: string | null;
  permissions: AppPermissions | undefined;
  isHydrated: boolean;
  isRefreshing: boolean;
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type SessionProviderProps = {
  children: React.ReactNode;
  /** Permissions from getServerSideProps (authoritative on first paint). */
  serverPermissions?: AppPermissions;
};

export function SessionProvider({ children, serverPermissions }: SessionProviderProps) {
  const [cached, setCached] = useState<AdminClientSession | null>(null);
  const [live, setLive] = useState<AdminClientSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshSession = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data } = await axios.get<{
        ok: boolean;
        userId: string;
        email: string | null;
        permissions: AppPermissions;
      }>('/api/auth/session', { withCredentials: true });

      if (data?.ok && data.userId && data.permissions) {
        const next = saveAdminClientSession({
          userId: data.userId,
          email: data.email,
          permissions: data.permissions,
        });
        setLive(next);
        setCached(next);
      }
    } catch (error) {
      reportError(error, { source: 'SessionProvider.refreshSession' });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setCached(readAdminClientSession());
    setIsHydrated(true);
    void refreshSession();
  }, [refreshSession]);

  const permissions = useMemo(() => {
    const fromLive = live?.permissions;
    const fromCache = cached?.permissions;
    const fromServer = serverPermissions;
    return pickBestPermissions(
      pickBestPermissions(fromServer, fromLive),
      fromCache,
    );
  }, [cached?.permissions, live?.permissions, serverPermissions]);

  const userId = live?.userId ?? cached?.userId ?? null;
  const email = live?.email ?? cached?.email ?? serverPermissions?.accountEmail ?? null;

  const value = useMemo<SessionContextValue>(
    () => ({
      userId,
      email,
      permissions,
      isHydrated,
      isRefreshing,
      refreshSession,
    }),
    [email, isHydrated, isRefreshing, permissions, refreshSession, userId],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    return {
      userId: null,
      email: null,
      permissions: undefined,
      isHydrated: false,
      isRefreshing: false,
      refreshSession: async () => {},
    };
  }
  return ctx;
}

export { clearAdminClientSession };
