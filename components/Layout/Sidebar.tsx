'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CalendarCheck,
  CheckSquare,
  ClipboardList,
  LayoutDashboard,
  Link2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import axios from 'axios';
import { setupUnlockHref } from '@/lib/setup';
import { reportError } from '@/lib/monitoring';
import { clearAdminClientSession, markLoggingOut } from '@/lib/client/adminSession';
import { useSession } from './SessionContext';
import { useSidebar } from './SidebarContext';
import InfoDialog from '@/components/ui/InfoDialog';
import { canMarkTeamAttendance } from '@/lib/permissions/attendanceAccess';
import { cn } from '@/lib/ui/cn';

export default function Sidebar() {
  const router = useRouter();
  const { collapsed, collapse, expand } = useSidebar();
  const { permissions } = useSession();
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  const handleLogout = async () => {
    try {
      markLoggingOut();
      clearAdminClientSession();
      await axios.post('/api/logout');
      await router.push('/login');
    } catch (e) {
      reportError(e, { source: 'Sidebar.handleLogout' });
    }
  };

  const canBlogs = permissions?.canManageBlogs ?? false;
  const canTasks = permissions?.canManageTasks ?? false;
  const canUsers = permissions?.canAccessUserManagement ?? false;
  const canMarkAttendance = canMarkTeamAttendance(permissions);

  const comingSoonNavItems = new Set(['My attendance', 'Mark attendance', 'All employees']);

  const handleNavItemClick = (itemName: string, event: React.MouseEvent<HTMLAnchorElement>) => {
    if (comingSoonNavItems.has(itemName)) {
      event.preventDefault();
      setComingSoonOpen(true);
    }
  };

  const navItems: Array<{ name: string; href: string; icon: typeof LayoutDashboard }> = [];
  if (canBlogs) {
    navItems.push({ name: 'Blog dashboard', href: '/', icon: LayoutDashboard });
    navItems.push({ name: 'Add / Connect Site', href: setupUnlockHref('/sites/connect'), icon: Link2 });
  }
  if (canTasks) {
    navItems.push({ name: 'Tasks', href: '/tasks', icon: CheckSquare });
  }
  navItems.push({ name: 'My attendance', href: '/attendance', icon: CalendarCheck });
  if (canMarkAttendance) {
    navItems.push({ name: 'Mark attendance', href: '/attendance/manage', icon: ClipboardList });
    navItems.push({ name: 'All employees', href: '/attendance/employees', icon: UserRound });
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
    if (item.name === 'My attendance') {
      return router.pathname === '/attendance';
    }
    if (item.name === 'Mark attendance') {
      return router.pathname === '/attendance/manage';
    }
    if (item.name === 'All employees') {
      return router.pathname === '/attendance/employees';
    }
    if (item.name === 'User management') {
      return router.pathname === '/admin/users' || router.pathname.startsWith('/admin/');
    }
    return router.pathname === item.href || (item.href !== '/' && router.pathname.startsWith(item.href));
  };

  const navLinkClass = (active: boolean, compact: boolean) =>
    cn(
      'group relative flex items-center rounded-[18px] transition-all duration-200',
      compact ? 'justify-center px-3 py-3' : 'gap-3 px-3.5 py-3 text-sm font-medium',
      active
        ? 'bg-white/[0.08] text-white'
        : 'text-[#9CA3AF] hover:bg-white/[0.05] hover:text-white',
    );

  return (
    <>
      <div className="border-b border-[#E5E7EB] bg-white/80 px-3 py-2 backdrop-blur-md md:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const isActive = isActiveItem(item);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={(event) => handleNavItemClick(item.name, event)}
                className={cn(
                  'inline-flex min-h-10 items-center gap-1.5 rounded-[18px] border px-3 py-2 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'border-[#5B5CEB]/30 bg-[#5B5CEB]/10 text-[#5B5CEB]'
                    : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]',
                )}
              >
                <item.icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
          <Link
            href="/settings"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#6B7280] transition hover:bg-[#F9FAFB]"
          >
            Profile
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-[18px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm font-medium text-[#DC2626] transition hover:bg-[#FEE2E2]"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Logout
          </button>
        </div>
      </div>

      <aside
        className={cn(
          'relative hidden md:flex md:flex-col border-r border-white/[0.06] bg-[#111111] text-white transition-[width] duration-300 ease-out',
          collapsed ? 'md:w-[4.5rem]' : 'md:w-72',
        )}
        aria-label="Main navigation"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-6">
          <div
            className={cn(
              'flex items-start gap-2 px-4',
              collapsed ? 'flex-col items-center' : 'justify-between',
            )}
          >
            {!collapsed ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold leading-tight tracking-tight text-white">
                    Skyen Systems
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[#9CA3AF]">Admin Panel</p>
                </div>
                <button
                  type="button"
                  onClick={collapse}
                  className="mt-1 shrink-0 rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-2.5 text-[#9CA3AF] transition hover:bg-white/[0.08] hover:text-white"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={expand}
                className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-2.5 text-[#9CA3AF] transition hover:bg-white/[0.08] hover:text-white"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </button>
            )}
          </div>

          <nav className={cn('mt-8 flex-1 space-y-1 px-3 pb-4', collapsed && 'flex flex-col items-center')}>
            {navItems.map((item) => {
              const isActive = isActiveItem(item);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  onClick={(event) => handleNavItemClick(item.name, event)}
                  className={navLinkClass(isActive, collapsed)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-[18px] border border-white/[0.08] bg-gradient-to-r from-[#5B5CEB]/20 to-[#7C3AED]/10"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-[#5B5CEB] to-[#7C3AED]" />
                  )}
                  <item.icon
                    className={cn(
                      'relative z-10 h-[18px] w-[18px] shrink-0',
                      isActive ? 'text-[#A5B4FC]' : 'text-[#6B7280] group-hover:text-[#D1D5DB]',
                    )}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {!collapsed && <span className="relative z-10 truncate">{item.name}</span>}
                </Link>
              );
            })}
            <Link
              href="/settings"
              title={collapsed ? 'Profile' : undefined}
              className={navLinkClass(router.pathname === '/settings', collapsed)}
              aria-current={router.pathname === '/settings' ? 'page' : undefined}
            >
              {router.pathname === '/settings' && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-[18px] border border-white/[0.08] bg-gradient-to-r from-[#5B5CEB]/20 to-[#7C3AED]/10"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              {router.pathname === '/settings' && !collapsed && (
                <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-[#5B5CEB] to-[#7C3AED]" />
              )}
              <Settings
                className={cn(
                  'relative z-10 h-[18px] w-[18px] shrink-0',
                  router.pathname === '/settings' ? 'text-[#A5B4FC]' : 'text-[#6B7280] group-hover:text-[#D1D5DB]',
                )}
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {!collapsed && <span className="relative z-10">Profile</span>}
            </Link>
          </nav>
        </div>

        <div className={cn('shrink-0 border-t border-white/[0.06] p-3', collapsed && 'flex justify-center')}>
          <motion.button
            type="button"
            onClick={() => void handleLogout()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'group relative block w-full overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.03] transition hover:border-red-500/30 hover:bg-red-500/[0.08]',
              collapsed ? 'p-3' : 'px-4 py-3',
            )}
            title="Logout"
            aria-label="Logout"
          >
            <div className={cn('flex items-center', collapsed && 'justify-center')}>
              <LogOut
                className="h-[18px] w-[18px] text-[#6B7280] transition group-hover:text-red-400"
                strokeWidth={1.75}
                aria-hidden
              />
              {!collapsed && (
                <span className="ml-3 text-sm font-medium text-[#9CA3AF] transition group-hover:text-red-300">
                  Logout
                </span>
              )}
            </div>
          </motion.button>
        </div>
      </aside>

      <InfoDialog
        open={comingSoonOpen}
        title="Coming soon!"
        description="This feature is on its way. Stay tuned."
        onClose={() => setComingSoonOpen(false)}
      />
    </>
  );
}
