'use client';

import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { SidebarProvider, useSidebar } from './SidebarContext';
import type { AppPermissions } from '@/lib/permissions/types';
import DataLoadError from '@/components/ui/DataLoadError';

type AdminLayoutClientProps = {
  children: React.ReactNode;
  permissions?: AppPermissions;
};

function AdminLayoutInner({ children, permissions }: AdminLayoutClientProps) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row">
      <Sidebar permissions={permissions} />
      <div className="flex min-w-0 flex-1 flex-col md:h-screen md:overflow-hidden">
        <Header permissions={permissions} />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8"
          tabIndex={-1}
        >
          <div className={collapsed ? 'mx-auto w-full max-w-none' : 'mx-auto w-full max-w-7xl'}>
            {permissions?.profileLoadError && (
              <DataLoadError
                className="mb-6"
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
    <SidebarProvider>
      <AdminLayoutInner permissions={permissions}>{children}</AdminLayoutInner>
    </SidebarProvider>
  );
}
