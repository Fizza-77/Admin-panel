'use client';

import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { SidebarProvider, useSidebar } from './SidebarContext';
import type { AppPermissions } from '@/lib/permissions/types';

type AdminLayoutClientProps = {
  children: React.ReactNode;
  permissions?: AppPermissions;
};

function AdminLayoutInner({ children, permissions }: AdminLayoutClientProps) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/40 font-sans">
      <Sidebar permissions={permissions} />
      <div className="flex flex-col flex-1 w-full min-w-0 md:h-screen md:overflow-hidden">
        <Header permissions={permissions} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
          <div
            className={
              collapsed
                ? 'w-full max-w-none mx-auto'
                : 'w-full max-w-7xl mx-auto'
            }
          >
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
