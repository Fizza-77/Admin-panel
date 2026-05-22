'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Users } from 'lucide-react';
import TaskNotifications from './TaskNotifications';
import type { AppPermissions } from '@/lib/permissions/types';
import { useSidebar } from './SidebarContext';

type HeaderProps = {
  permissions?: AppPermissions;
};

function displayLabel(permissions?: AppPermissions) {
  const n = permissions?.displayName?.trim();
  if (n) {
    return n;
  }
  const e = permissions?.accountEmail?.trim();
  if (e) {
    return e.split('@')[0] ?? e;
  }
  return 'User';
}

function initials(permissions?: AppPermissions) {
  const n = permissions?.displayName?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = permissions?.accountEmail?.trim();
  if (e) {
    return e.slice(0, 2).toUpperCase();
  }
  return 'U';
}

export default function Header({ permissions }: HeaderProps) {
  const router = useRouter();
  const { collapsed, expand } = useSidebar();
  const canBlogs = permissions?.canManageBlogs ?? false;
  const canTasks = permissions?.canManageTasks ?? false;
  const canUsers = permissions?.canAccessUserManagement ?? false;
  const onRoot = router.pathname === '/';
  const pageLabel = router.pathname
    .replace('/sites', 'sites')
    .replace('/blogs', 'blogs')
    .replace(/\[|\]/g, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/-/g, ' '))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ');

  return (
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 z-10">
      <div className="flex items-start sm:items-center justify-between px-3 sm:px-6 lg:px-8 min-h-16 py-3 gap-2 sm:gap-3">
        <div className="flex items-start sm:items-center gap-1.5 sm:gap-3 min-w-0">
          {collapsed && (
            <button
              type="button"
              onClick={expand}
              className="hidden md:inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              title="Expand sidebar"
            >
              +
            </button>
          )}
          {!onRoot && (
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 sm:px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400 truncate">Skyen Admin</p>
            <p className="text-sm font-semibold text-slate-800 truncate">{pageLabel || 'Dashboard'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {canBlogs && (
            <Link
              href="/"
              className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Blog dashboard
            </Link>
          )}
          {canTasks && (
            <Link
              href="/tasks"
              className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Tasks
            </Link>
          )}
          {canUsers && (
            <Link
              href="/admin/users"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Users className="h-3.5 w-3.5" aria-hidden />
              Users
            </Link>
          )}
          <Link
            href="/settings"
            className="hidden sm:inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 max-w-[140px] truncate"
            title={permissions?.accountEmail ?? 'Profile'}
          >
            {displayLabel(permissions)}
          </Link>
          <TaskNotifications enabled={canTasks} />
          <Link
            href="/settings"
            className="inline-flex h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-cyan-100 items-center justify-center text-cyan-800 font-bold text-xs sm:text-sm hover:bg-cyan-200"
            title="Profile settings"
          >
            {initials(permissions)}
          </Link>
        </div>
      </div>
    </header>
  );
}
