'use client';

import { useRouter } from 'next/router';
import Link from 'next/link';
import { CheckSquare, LayoutDashboard, Link2, LogOut, Minus, Plus, Users } from 'lucide-react';
import axios from 'axios';
import { setupUnlockHref } from '@/lib/setup';
import { reportError } from '@/lib/monitoring';
import type { AppPermissions } from '@/lib/permissions/types';
import { useSidebar } from './SidebarContext';

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

  return (
    <>
      <div className="md:hidden border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const isActive = isActiveItem(item);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
          <Link
            href="/settings"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Profile
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>

      <div
        className={`hidden md:flex md:flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 border-r border-slate-800 shadow-2xl transition-[width] duration-200 ease-out ${
          collapsed ? 'md:w-16' : 'md:w-72'
        }`}
      >
        <div className="flex flex-col flex-grow pt-4 overflow-y-auto min-h-0">
          <div className={`px-3 flex items-start gap-1 ${collapsed ? 'flex-col items-center' : 'justify-between'}`}>
            {!collapsed ? (
              <>
                <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2 flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Control Panel</p>
                  <p className="mt-0.5 text-base font-semibold text-white truncate">Skyen Admin</p>
                </div>
                <button
                  type="button"
                  onClick={collapse}
                  className="shrink-0 mt-1 rounded-lg border border-slate-600 bg-slate-800/80 p-1.5 text-slate-200 hover:bg-slate-700 hover:text-white"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={expand}
                className="mx-auto rounded-lg border border-slate-600 bg-slate-800/80 p-2 text-slate-200 hover:bg-slate-700 hover:text-white"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="mt-6 flex-grow flex flex-col">
            <nav className={`flex-1 px-2 pb-4 space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
              {navItems.map((item) => {
                const isActive = isActiveItem(item);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={collapsed ? item.name : undefined}
                    className={`group flex items-center rounded-lg transition-colors border ${
                      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5 text-sm font-medium'
                    } ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/30'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                    }`}
                  >
                    <item.icon
                      className={`flex-shrink-0 h-5 w-5 ${
                        collapsed ? '' : '-ml-1 mr-3'
                      } ${isActive ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'}`}
                      aria-hidden="true"
                    />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
              <Link
                href="/settings"
                title={collapsed ? 'Profile' : undefined}
                className={`group flex items-center rounded-lg transition-colors border ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5 text-sm font-medium'
                } ${
                  router.pathname === '/settings'
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                }`}
              >
                <span
                  className={`flex-shrink-0 h-5 w-5 rounded-full bg-slate-600 text-[10px] flex items-center justify-center ${
                    collapsed ? '' : 'mr-3'
                  }`}
                >
                  Me
                </span>
                {!collapsed && <span>Profile</span>}
              </Link>
            </nav>
          </div>
          <div className={`flex-shrink-0 border-t border-slate-800 p-2 ${collapsed ? 'flex justify-center' : ''}`}>
            <button
              onClick={handleLogout}
              className={`group block rounded-lg hover:bg-red-500/15 border border-slate-700 hover:border-red-400/50 transition ${
                collapsed ? 'p-2' : 'w-full p-3'
              }`}
              title="Logout"
            >
              <div className={`flex items-center ${collapsed ? 'justify-center' : ''}`}>
                <LogOut
                  className={`h-5 w-5 text-slate-400 group-hover:text-red-300 ${collapsed ? '' : 'inline-block'}`}
                />
                {!collapsed && (
                  <div className="ml-3">
                    <p className="text-sm font-medium text-slate-200 group-hover:text-red-200">Logout</p>
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
