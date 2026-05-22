import Link from 'next/link';
import { ArrowRight, ExternalLink, Globe2, AlertCircle } from 'lucide-react';
import { setupUnlockHref } from '@/lib/setup';
import type { Site } from '@/types/site';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

interface SitesListProps {
  sites: Site[];
  hasLoadError?: boolean;
}

export default function SitesList({ sites, hasLoadError = false }: SitesListProps) {
  const connectedSites = sites.filter((site) => site.site_key && site.site_key.trim().length > 0);
  const incompletesSites = sites.filter((site) => !site.site_key || !site.site_key.trim().length);

  return (
    <>
      <PageHeader
        title="Connected websites"
        description="Manage each website with setup, blogs, and publishing actions."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Sites' }]}
        actions={
          <Link href={setupUnlockHref('/sites/connect')} className="ui-btn-primary w-full sm:w-auto">
            Add site
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />

      {hasLoadError && (
        <div
          className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          Could not load sites right now. Please refresh the page and check server logs if this keeps happening.
        </div>
      )}

      {connectedSites.length === 0 && !hasLoadError ? (
        <EmptyState
          icon={<Globe2 className="mx-auto h-12 w-12" aria-hidden />}
          title="No connected sites yet"
          description="Use Add site to configure your first website and start publishing blogs."
          action={
            <Link href={setupUnlockHref('/sites/connect')} className="ui-btn-primary">
              Add your first site
            </Link>
          }
        />
      ) : connectedSites.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {connectedSites.map((site) => (
            <article
              key={site.id}
              className="ui-surface-elevated group flex flex-col p-6 transition hover:border-indigo-200/80 hover:shadow-card"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-zinc-900">
                    {site.name || site.domain || site.site_key}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">{site.domain || 'No domain configured'}</p>
                  <p className="mt-2 font-mono text-xs text-zinc-400">site_key: {site.site_key}</p>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Globe2 className="h-4 w-4" aria-hidden />
                </span>
              </div>

              <div className="mt-auto grid grid-cols-1 gap-2 border-t border-zinc-100 pt-4">
                <Link
                  href={`/sites/${site.id}/blogs`}
                  className="ui-btn-secondary w-full text-center"
                >
                  View blogs
                </Link>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={setupUnlockHref(`/sites/${site.id}/setup`)}
                    className="ui-btn-secondary flex-1 text-center !border-indigo-200 !text-indigo-700 hover:!bg-indigo-50"
                  >
                    Setup
                  </Link>
                  <Link href={`/sites/${site.id}/blogs/create`} className="ui-btn-primary flex-1 text-center">
                    New blog
                  </Link>
                </div>
              </div>

              <p className="mt-3 flex items-center gap-1 text-xs text-zinc-400">
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                Public blog URLs are handled by the site frontend.
              </p>
            </article>
          ))}
        </div>
      ) : null}

      {hasLoadError && sites.length === 0 && (
        <EmptyState
          icon={<Globe2 className="mx-auto h-12 w-12" aria-hidden />}
          title="Sites are temporarily unavailable"
          description="This is usually a temporary fetch issue, not an actual zero-sites state."
        />
      )}

      {incompletesSites.length > 0 && (
        <section className="mt-10" aria-labelledby="incomplete-sites-heading">
          <h2
            id="incomplete-sites-heading"
            className="mb-4 flex items-center gap-2 text-lg font-semibold text-amber-900"
          >
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
            Incomplete sites (missing site_key)
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {incompletesSites.map((site) => (
              <article
                key={site.id}
                className="flex flex-col rounded-2xl border border-amber-200 bg-amber-50/80 p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-amber-950">
                    {site.name || site.domain || 'Unnamed Site'}
                  </h3>
                  <p className="mt-1 text-sm text-amber-800">{site.domain || 'No domain configured'}</p>
                  <p className="mt-2 inline-block rounded-lg bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                    Missing site_key
                  </p>
                </div>

                <div className="mt-auto border-t border-amber-200/80 pt-4">
                  <Link
                    href={setupUnlockHref(`/sites/${site.id}/setup`)}
                    className="ui-btn-primary w-full !bg-amber-600 hover:!bg-amber-500"
                  >
                    Complete setup
                  </Link>
                </div>

                <p className="mt-3 text-xs text-amber-800/90">
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
