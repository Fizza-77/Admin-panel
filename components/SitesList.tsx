import Link from 'next/link';
import { ArrowRight, ExternalLink, Globe2, AlertCircle } from 'lucide-react';
import { setupUnlockHref } from '@/lib/setup';
import type { Site } from '@/types/site';

interface SitesListProps {
  sites: Site[];
  hasLoadError?: boolean;
}

export default function SitesList({ sites, hasLoadError = false }: SitesListProps) {
  const connectedSites = sites.filter((site) => site.site_key && site.site_key.trim().length > 0);
  const incompletesSites = sites.filter((site) => !site.site_key || !site.site_key.trim().length);

  return (
    <>
      <div className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Connected Websites</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Manage each website with setup, blogs, and publishing actions.</p>
        </div>
        <Link
          href={setupUnlockHref('/sites/connect')}
          className="w-full sm:w-auto justify-center inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-lg transition text-sm shadow-sm"
        >
          Add Site
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {hasLoadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load sites right now. Please refresh the page and check server logs if this keeps happening.
        </div>
      )}

      {connectedSites.length === 0 && !hasLoadError ? (
        <div className="bg-white rounded-2xl border border-slate-200 border-dashed py-12 sm:py-16 px-5 sm:px-6 text-center shadow-sm">
          <Globe2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-700 mb-2 font-semibold">No connected sites yet</p>
          <p className="text-slate-500 text-sm">
            Use <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">Add Site</code> to configure your
            first website.
          </p>
        </div>
      ) : connectedSites.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connectedSites.map((site) => (
            <div
              key={site.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {site.name || site.domain || site.site_key}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">{site.domain || 'No domain configured'}</p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">site_key: {site.site_key}</p>
                </div>
              </div>

              <div className="mt-auto grid grid-cols-1 gap-2 pt-4 border-t border-slate-100">
                <Link
                  href={`/sites/${site.id}/blogs`}
                  className="text-center bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium py-2 px-4 rounded-lg border border-slate-200 transition text-sm"
                >
                  View blogs
                </Link>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Link
                    href={setupUnlockHref(`/sites/${site.id}/setup`)}
                    className="flex-1 text-center bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-medium py-2 px-4 rounded-lg border border-cyan-200 transition text-sm"
                  >
                    Setup
                  </Link>
                  <Link
                    href={`/sites/${site.id}/blogs/create`}
                    className="flex-1 text-center bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 px-4 rounded-lg transition text-sm"
                  >
                    New blog
                  </Link>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-400 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                <span>Public blog URLs are handled by the site frontend.</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {hasLoadError && sites.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 border-dashed py-12 sm:py-16 px-5 sm:px-6 text-center shadow-sm">
          <Globe2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-slate-700 mb-2 font-semibold">Sites are temporarily unavailable</p>
          <p className="text-slate-500 text-sm">This is usually a temporary fetch issue, not an actual zero-sites state.</p>
        </div>
      )}

      {/* Incomplete sites (missing site_key) */}
      {incompletesSites.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Incomplete Sites (missing site_key)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {incompletesSites.map((site) => (
              <div
                key={site.id}
                className="bg-amber-50 rounded-2xl shadow-sm border border-amber-200 p-6 flex flex-col hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-amber-900">
                      {site.name || site.domain || 'Unnamed Site'}
                    </h3>
                    <p className="text-sm text-amber-800 mt-1">{site.domain || 'No domain configured'}</p>
                    <p className="text-xs text-amber-700 mt-2 bg-amber-100 inline-block px-2 py-1 rounded">
                      ⚠️ Missing site_key
                    </p>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-amber-200">
                  <Link
                    href={setupUnlockHref(`/sites/${site.id}/setup`)}
                    className="w-full text-center bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg transition text-sm"
                  >
                    Complete Setup
                  </Link>
                </div>

                <div className="mt-3 text-xs text-amber-700">
                  <p>
                    Complete the setup to assign a <code className="font-mono bg-amber-100 px-1 rounded">site_key</code> and activate this site.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
