'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { ArrowLeft, PanelLeft, Settings } from 'lucide-react';
import TaskNotifications from './TaskNotifications';
import UserAvatar from '@/components/ui/UserAvatar';
import { userDisplayLabel } from '@/lib/users/display';
import { useSession } from './SessionContext';
import { useSidebar } from './SidebarContext';
import { breadcrumbsFromPath } from '@/lib/ui/breadcrumbs';
import { cn } from '@/lib/ui/cn';

export default function Header() {
  const router = useRouter();
  const { collapsed, expand } = useSidebar();
  const { permissions } = useSession();
  const showNotifications = Boolean(permissions);
  const onRoot = router.pathname === '/';
  const crumbs = breadcrumbsFromPath(router.pathname);
  const pageTitle = crumbs.length > 0 ? crumbs[crumbs.length - 1].label : 'Blogs';

  return (
    <header className="sticky top-0 z-20 border-b border-[#E5E7EB]/80 bg-white/70 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
      <div className="flex min-h-[4.5rem] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {collapsed && (
            <button
              type="button"
              onClick={expand}
              className="hidden md:inline-flex ui-btn-ghost !min-h-10 !rounded-[18px] !px-3"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          )}
          {!onRoot && (
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] transition hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827] sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2.5"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              <span className="hidden sm:inline text-xs font-medium">Back</span>
            </button>
          )}
          <div className="min-w-0">
            {crumbs.length > 1 && (
              <nav
                aria-label="Breadcrumb"
                className="mb-1 hidden sm:flex flex-wrap items-center gap-1 text-xs text-[#6B7280]"
              >
                {crumbs.slice(0, -1).map((crumb, i) => (
                  <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1">
                    {i > 0 && <span aria-hidden className="text-[#D1D5DB]">/</span>}
                    {crumb.href ? (
                      <Link href={crumb.href} className="transition hover:text-[#111827]">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <p className="truncate text-base font-semibold tracking-tight text-[#111827] sm:text-lg">{pageTitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <TaskNotifications enabled={showNotifications} />

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/settings"
              className={cn(
                'inline-flex items-center justify-center rounded-full border border-[#1e3a8a]/20 transition hover:border-[#1e3a8a]/35',
              )}
              title={permissions?.accountEmail ?? 'Profile settings'}
              aria-label={`Profile: ${userDisplayLabel(permissions?.displayName, permissions?.accountEmail)}`}
            >
              <UserAvatar
                label={userDisplayLabel(permissions?.displayName, permissions?.accountEmail)}
                avatarUrl={permissions?.avatarUrl}
                size="sm"
                className="border border-[#1e3a8a]/15"
              />
            </Link>
          </motion.div>

          <Link
            href="/settings"
            className="ui-btn-ghost !min-h-10 hidden sm:inline-flex"
            title="Settings"
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
