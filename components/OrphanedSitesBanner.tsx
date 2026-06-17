import Link from 'next/link';
import { setupUnlockHref } from '@/lib/setup';
import type { OrphanedBlogSite } from '@/lib/sites/orphanedBlogSites';

type OrphanedSitesBannerProps = {
  orphans: OrphanedBlogSite[];
};

export default function OrphanedSitesBanner({ orphans }: OrphanedSitesBannerProps) {
  if (orphans.length === 0) {
    return null;
  }

  const totalBlogs = orphans.reduce((sum, item) => sum + item.blog_count, 0);

  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
      <p className="font-semibold">Blog posts exist without a connected site record</p>
      <p className="mt-2">
        The database has <span className="font-medium">{totalBlogs}</span> blog post
        {totalBlogs === 1 ? '' : 's'} linked to <span className="font-medium">{orphans.length}</span> site id
        {orphans.length === 1 ? '' : 's'} that {orphans.length === 1 ? 'is' : 'are'} missing from the{' '}
        <code className="rounded bg-amber-100 px-1">sites</code> table. New blog creation will fail with &quot;Site not
        found&quot; until each one is re-connected.
      </p>
      <ul className="mt-4 space-y-2">
        {orphans.map((orphan) => (
          <li
            key={orphan.site_id}
            className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-mono text-xs break-all text-amber-900">{orphan.site_id}</p>
              <p className="text-xs text-amber-800">
                {orphan.blog_count} blog post{orphan.blog_count === 1 ? '' : 's'}
              </p>
            </div>
            <Link
              href={setupUnlockHref(`/sites/${orphan.site_id}/recover`)}
              className="inline-flex shrink-0 justify-center rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700"
            >
              Re-connect site
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
