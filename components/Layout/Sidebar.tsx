'use client';

import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  CheckSquare,
  LayoutDashboard,
  Link2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from 'lucide-react';
import axios from 'axios';
import { setupUnlockHref } from '@/lib/setup';
import { reportError } from '@/lib/monitoring';
import type { AppPermissions } from '@/lib/permissions/types';
import { useSidebar } from './SidebarContext';
import { cn } from '@/lib/ui/cn';

type SidebarProps = {
  permissions?: AppPermissions;
};

export default function Sidebar({ permissions }: SidebarProps) {
  const router = useRouter();
  const { collapsed, collapse, expand } = useSidebar();

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout');
      await router.push('/login');
    } catch (e) {
      reportError(e, { source: 'Sidebar.handleLogout' });
    }
  };

  const canBlogs = permissions?.canManageBlogs ?? false;
  const canTasks = permissions?.canManageTasks ?? false;
  const canUsers = permissions?.canAccessUserManagement ?? false;

  const navItems: Array<{ name: string; href: string; icon: typeof LayoutDashboard }> = [];
  if (canBlogs) {
    navItems.push({ name: 'Blog dashboard', href: '/', icon: LayoutDashboard });
    navItems.push({ name: 'Add / Connect Site', href: setupUnlockHref('/sites/connect'), icon: Link2 });
  }
  if (canTasks) {
    navItems.push({ name: 'Tasks', href: '/tasks', icon: CheckSquare });
  }
  if (canUsers) {
    navItems.push({ name: 'User management', href: '/admin/users', icon: Users });
  }

  const isActiveItem = (item: { name: string; href: string }) => {
    if (item.name === 'Blog dashboard') {
      return router.pathname === '/';
    }
    if (item.name === 'Add / Connect Site') {
      return router.pathname === '/sites/connect' || router.pathname === '/setup-unlock';
    }
    if (item.name === 'Tasks') {
      return router.pathname === '/tasks' || router.pathname.startsWith('/tasks/');
    }
    if (item.name === 'User management') {
      return router.pathname === '/admin/users' || router.pathname.startsWith('/admin/');
    }
    return router.pathname === item.href || (item.href !== '/' && router.pathname.startsWith(item.href));
  };

  const navLinkClass = (active: boolean, compact: boolean) =>
    cn(
      'group flex items-center rounded-xl border transition-all duration-200',
      compact ? 'justify-center px-2.5 py-2.5' : 'gap-3 px-3 py-2.5 text-sm font-medium',
      active
        ? 'border-indigo-500/30 bg-indigo-500/15 text-indigo-100 shadow-sm'
        : 'border-transparent text-zinc-400 hover:border-zinc-700/50 hover:bg-zinc-800/80 hover:text-zinc-100',
    );

  return (
    <>
      <div className="border-b border-zinc-200 bg-white px-3 py-2 md:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const isActive = isActiveItem(item);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100',
                )}
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
          <Link
            href="/settings"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Profile
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Logout
          </button>
        </div>
      </div>

      <aside
        className={cn(
          'hidden md:flex md:flex-col border-r border-zinc-800/80 bg-zinc-950 text-zinc-100 shadow-xl transition-[width] duration-200 ease-out',
          collapsed ? 'md:w-[4.25rem]' : 'md:w-72',
        )}
        aria-label="Main navigation"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-4">
          <div
            className={cn(
              'flex items-start gap-2 px-3',
              collapsed ? 'flex-col items-center' : 'justify-between',
            )}
          >
            {!collapsed ? (
              <>
                <div className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500">Skyen Systems</p>
                  <p className="mt-0.5 truncate text-base font-semibold text-white">Admin Panel</p>
                </div>
                <button
                  type="button"
                  onClick={collapse}
                  className="mt-1 shrink-0 rounded-xl border border-zinc-700 bg-zinc-800/90 p-2 text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={expand}
                className="rounded-xl border border-zinc-700 bg-zinc-800/90 p-2 text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-5 w-5" aria-hidden />
              </button>
            )}
          </div>

          <nav className={cn('mt-6 flex-1 space-y-1 px-2 pb-4', collapsed && 'flex flex-col items-center')}>
            {navItems.map((item) => {
              const isActive = isActiveItem(item);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={navLinkClass(isActive, collapsed)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      isActive ? 'text-indigo-300' : 'text-zinc-500 group-hover:text-zinc-200',
                    )}
                    aria-hidden="true"
                  />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
            <Link
              href="/settings"
              title={collapsed ? 'Profile' : undefined}
              className={navLinkClass(router.pathname === '/settings', collapsed)}
              aria-current={router.pathname === '/settings' ? 'page' : undefined}
            >
              <Settings
                className={cn(
                  'h-5 w-5 shrink-0',
                  router.pathname === '/settings' ? 'text-indigo-300' : 'text-zinc-500 group-hover:text-zinc-200',
                )}
                aria-hidden="true"
              />
              {!collapsed && <span>Profile</span>}
            </Link>
          </nav>
        </div>

        <div className={cn('shrink-0 border-t border-zinc-800 p-2', collapsed && 'flex justify-center')}>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className={cn(
              'group block w-full rounded-xl border border-zinc-800 transition hover:border-red-500/40 hover:bg-red-500/10',
              collapsed ? 'p-2' : 'p-3',
            )}
            title="Logout"
            aria-label="Logout"
          >
            <div className={cn('flex items-center', collapsed && 'justify-center')}>
              <LogOut className="h-5 w-5 text-zinc-500 transition group-hover:text-red-300" aria-hidden />
              {!collapsed && (
                <span className="ml-3 text-sm font-medium text-zinc-300 group-hover:text-red-200">Logout</span>
              )}
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
