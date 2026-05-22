'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, PanelLeft, Search, Settings } from 'lucide-react';
import TaskNotifications from './TaskNotifications';
import type { AppPermissions } from '@/lib/permissions/types';
import { useSidebar } from './SidebarContext';
import { breadcrumbsFromPath } from '@/lib/ui/breadcrumbs';
import { cn } from '@/lib/ui/cn';

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
  const canTasks = permissions?.canManageTasks ?? false;
  const onRoot = router.pathname === '/';
  const crumbs = breadcrumbsFromPath(router.pathname);
  const pageTitle = crumbs.length > 0 ? crumbs[crumbs.length - 1].label : 'Dashboard';

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
      <div className="flex min-h-[4rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {collapsed && (
            <button
              type="button"
              onClick={expand}
              className="hidden md:inline-flex ui-btn-ghost !min-h-9 !px-2.5"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="h-4 w-4" aria-hidden />
            </button>
          )}
          {!onRoot && (
            <button
              type="button"
              onClick={() => router.back()}
              className="ui-btn-secondary !min-h-9 shrink-0 !px-3"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <div className="min-w-0">
            {crumbs.length > 1 && (
              <nav aria-label="Breadcrumb" className="mb-0.5 hidden sm:flex flex-wrap items-center gap-1 text-[11px] text-zinc-500">
                {crumbs.slice(0, -1).map((crumb, i) => (
                  <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1">
                    {i > 0 && <span aria-hidden className="text-zinc-300">/</span>}
                    {crumb.href ? (
                      <Link href={crumb.href} className="hover:text-zinc-800 transition-colors">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <p className="truncate text-sm font-semibold text-zinc-900 sm:text-base">{pageTitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center">
            <label className="sr-only" htmlFor="header-quick-search">
              Quick search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <input
                id="header-quick-search"
                type="search"
                placeholder="Search…"
                className="ui-input !min-h-9 w-44 xl:w-52 !py-1.5 !pl-9 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canTasks) {
                    const v = (e.target as HTMLInputElement).value.trim();
                    const q = v ? `?q=${encodeURIComponent(v)}` : '';
                    void router.push(`/tasks${q}`);
                  }
                }}
                aria-describedby="header-search-hint"
              />
            </div>
            <p id="header-search-hint" className="sr-only">
              Press Enter to search tasks
            </p>
          </div>

          <TaskNotifications enabled={canTasks} />

          <Link
            href="/settings"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-800 transition hover:bg-indigo-200 sm:h-10 sm:w-10 sm:text-sm',
            )}
            title={permissions?.accountEmail ?? 'Profile settings'}
            aria-label={`Profile: ${displayLabel(permissions)}`}
          >
            <span aria-hidden>{initials(permissions)}</span>
          </Link>

          <Link
            href="/settings"
            className="ui-btn-ghost !min-h-9 hidden sm:inline-flex"
            title="Settings"
          >
            <Settings className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
