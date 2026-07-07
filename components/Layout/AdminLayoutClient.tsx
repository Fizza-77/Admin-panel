'use client';

import React from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import Header from './Header';
import { SidebarProvider, useSidebar } from './SidebarContext';
import type { AppPermissions } from '@/lib/permissions/types';
import DataLoadError from '@/components/ui/DataLoadError';
import { SessionProvider, useSession } from './SessionContext';
import { isBlogEditorPath } from '@/lib/ui/blogEditorRoutes';

type AdminLayoutClientProps = {
  children: React.ReactNode;
  permissions?: AppPermissions;
};

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { collapsed } = useSidebar();
  const { permissions } = useSession();
  const hideHeader = isBlogEditorPath(router.pathname);

  return (
    <div className="admin-shell-bg relative flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col md:h-screen md:overflow-hidden">
        {!hideHeader && <Header />}
        <main
          id="main-content"
          className={`flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-10 ${
            hideHeader ? 'py-4 sm:py-6' : 'py-6 sm:py-8'
          }`}
          tabIndex={-1}
        >
          <div
            className={collapsed ? 'mx-auto w-full max-w-none' : 'mx-auto w-full max-w-7xl'}
          >
            {permissions?.profileLoadError && (
              <DataLoadError
                className="mb-8"
                title="Permission profile unavailable"
                message="Your session is valid, but access flags could not be loaded from the database. Features may be blocked until this is resolved."
                detail={permissions.profileLoadError}
              />
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdminLayoutClient({ children, permissions }: AdminLayoutClientProps) {
  return (
    <SessionProvider serverPermissions={permissions}>
      <SidebarProvider>
        <AdminLayoutInner>{children}</AdminLayoutInner>
      </SidebarProvider>
    </SessionProvider>
  );
}
