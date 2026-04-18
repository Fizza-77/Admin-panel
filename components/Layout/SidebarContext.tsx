'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

type SidebarArea = 'blog' | 'tasks' | 'admin';

type SidebarContextValue = {
  collapsed: boolean;
  /** Collapse sidebar (save per dashboard area). */
  collapse: () => void;
  /** Expand sidebar. */
  expand: () => void;
  toggle: () => void;
  area: SidebarArea;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function areaFromPath(pathname: string): SidebarArea {
  if (pathname.startsWith('/tasks')) {
    return 'tasks';
  }
  if (pathname.startsWith('/admin')) {
    return 'admin';
  }
  return 'blog';
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const area = useMemo(() => areaFromPath(router.pathname), [router.pathname]);
  const storageKey = `admin_sidebar_collapsed_${area}`;

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(typeof window !== 'undefined' && localStorage.getItem(storageKey) === '1');
    } catch {
      setCollapsed(false);
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      setCollapsed(next);
    },
    [storageKey],
  );

  const collapse = useCallback(() => persist(true), [persist]);
  const expand = useCallback(() => persist(false), [persist]);
  const toggle = useCallback(() => persist(!collapsed), [collapsed, persist]);

  const value = useMemo(
    () => ({
      collapsed,
      collapse,
      expand,
      toggle,
      area,
    }),
    [collapsed, collapse, expand, toggle, area],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return ctx;
}
