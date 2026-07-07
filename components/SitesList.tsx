'use client';

import { motion } from 'framer-motion';
import { Globe2, AlertCircle } from 'lucide-react';
import { setupUnlockHref } from '@/lib/setup';
import type { Site } from '@/types/site';
import EmptyState from '@/components/ui/EmptyState';
import DataLoadError from '@/components/ui/DataLoadError';
import SiteLogo from '@/components/SiteLogo';
import OutlineFillButton, {
  BlogsListIcon,
  PlusIcon,
  SetupIcon,
} from '@/components/ui/OutlineFillButton';
import { pageEnter, staggerContainer } from '@/lib/ui/motion';

interface SitesListProps {
  sites: Site[];
  hasLoadError?: boolean;
  loadErrorMessage?: string | null;
  loadWarningMessage?: string | null;
}

export default function SitesList({
  sites,
  hasLoadError = false,
  loadErrorMessage = null,
  loadWarningMessage = null,
}: SitesListProps) {
  const connectedSites = sites.filter((site) => site.site_key && site.site_key.trim().length > 0);
  const incompletesSites = sites.filter((site) => !site.site_key || !site.site_key.trim().length);

  return (
    <>
      {hasLoadError && (
        <DataLoadError
          className="mb-8"
          title="Could not load sites"
          message="The database query failed. This is not the same as having zero sites."
          detail={loadErrorMessage}
        />
      )}

      {!hasLoadError && loadWarningMessage && (
        <DataLoadError
          className="mb-8 border-amber-200 bg-amber-50 text-amber-900 [&_p]:text-amber-800"
          title="Sites loaded with a warning"
          message={loadWarningMessage}
        />
      )}

      {connectedSites.length === 0 && !hasLoadError ? (
        <EmptyState
          icon={<Globe2 className="mx-auto h-12 w-12 text-[#9CA3AF]" strokeWidth={1.25} aria-hidden />}
          title="No connected sites yet"
          description="No websites are connected to this admin panel yet."
        />
      ) : connectedSites.length > 0 ? (
        <motion.div
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {connectedSites.map((site) => (
            <motion.article
              key={site.id}
              variants={pageEnter}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="group flex h-full flex-col rounded-[20px] border border-[#E5E7EB] bg-white p-7 shadow-card transition-shadow duration-300 hover:border-[#5B5CEB]/20 hover:shadow-card-hover"
            >
              <div className="mb-6 flex items-start gap-4">
                <SiteLogo site={site} size="lg" />
                <div className="min-w-0 pt-1">
                  <h2 className="truncate text-lg font-semibold tracking-tight text-[#111827]">
                    {site.name || site.domain || site.site_key}
                  </h2>
                  <p className="mt-2 font-mono text-xs text-[#6B7280]">
                    <span className="text-[#9CA3AF]">site_key:</span> {site.site_key}
                  </p>
                </div>
              </div>

              <div className="mt-auto space-y-2 border-t border-[#F3F4F6] pt-5">
                <OutlineFillButton href={`/sites/${site.id}/blogs`} icon={<BlogsListIcon />}>
                  View blogs
                </OutlineFillButton>
                <div className="flex flex-row items-stretch gap-2">
                  <OutlineFillButton
                    href={setupUnlockHref(`/sites/${site.id}/setup`)}
                    className="flex-1"
                    icon={<SetupIcon />}
                  >
                    Setup
                  </OutlineFillButton>
                  <OutlineFillButton
                    href={`/sites/${site.id}/blogs/create`}
                    className="flex-1"
                    icon={<PlusIcon />}
                  >
                    New blog
                  </OutlineFillButton>
                </div>
              </div>
            </motion.article>
          ))}
        </motion.div>
      ) : null}

      {hasLoadError && sites.length === 0 && (
        <EmptyState
          icon={<Globe2 className="mx-auto h-12 w-12 text-[#9CA3AF]" strokeWidth={1.25} aria-hidden />}
          title="Sites are temporarily unavailable"
          description="This is usually a temporary fetch issue, not an actual zero-sites state."
        />
      )}

      {incompletesSites.length > 0 && (
        <section className="mt-12" aria-labelledby="incomplete-sites-heading">
          <h2
            id="incomplete-sites-heading"
            className="mb-6 flex items-center gap-2 text-lg font-semibold text-amber-900"
          >
            <AlertCircle className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
            Incomplete sites (missing site_key)
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {incompletesSites.map((site) => (
              <article
                key={site.id}
                className="flex h-full flex-col rounded-[20px] border border-amber-200/80 bg-amber-50/60 p-7 shadow-soft backdrop-blur-sm transition hover:shadow-card"
              >
                <div className="mb-6 flex items-start gap-4">
                  <SiteLogo site={site} size="lg" />
                  <div className="min-w-0 pt-1">
                    <h3 className="text-lg font-semibold text-amber-950">
                      {site.name || site.domain || 'Unnamed Site'}
                    </h3>
                    <p className="mt-3 inline-block rounded-[14px] bg-amber-100/80 px-3 py-1 text-xs font-medium text-amber-800">
                      Missing site_key
                    </p>
                  </div>
                </div>

                <div className="mt-auto border-t border-amber-200/60 pt-5">
                  <OutlineFillButton
                    href={setupUnlockHref(`/sites/${site.id}/setup`)}
                    icon={<SetupIcon />}
                  >
                    Complete setup
                  </OutlineFillButton>
                </div>

                <p className="mt-4 text-xs leading-relaxed text-amber-800/90">
                  Complete setup to assign a{' '}
                  <code className="rounded bg-amber-100 px-1 font-mono">site_key</code> and activate this site.
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
