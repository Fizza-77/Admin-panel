import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';

export type OrphanedBlogSite = {
  site_id: string;
  blog_count: number;
};

/**
 * Blog rows whose `site_id` has no matching row in `public.sites`.
 * Common after sites were deleted or never migrated while blogs remained.
 */
export async function listOrphanedBlogSites(): Promise<{
  orphans: OrphanedBlogSite[];
  error: string | null;
}> {
  const { data: blogs, error: blogsError } = await supabase.from('blogs').select('site_id');

  if (blogsError) {
    reportError(blogsError, { source: 'listOrphanedBlogSites.blogs' });
    return { orphans: [], error: blogsError.message ?? 'Failed to load blogs' };
  }

  const counts = new Map<string, number>();
  for (const row of blogs ?? []) {
    const id = typeof row.site_id === 'string' ? row.site_id : null;
    if (!id) {
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return { orphans: [], error: null };
  }

  const siteIds = Array.from(counts.keys());
  const { data: sites, error: sitesError } = await supabase.from('sites').select('id').in('id', siteIds);

  if (sitesError) {
    reportError(sitesError, { source: 'listOrphanedBlogSites.sites' });
    return { orphans: [], error: sitesError.message ?? 'Failed to load sites' };
  }

  const existing = new Set((sites ?? []).map((s) => s.id));
  const orphans: OrphanedBlogSite[] = [];

  for (const site_id of siteIds) {
    if (!existing.has(site_id)) {
      orphans.push({ site_id, blog_count: counts.get(site_id) ?? 0 });
    }
  }

  orphans.sort((a, b) => b.blog_count - a.blog_count);
  return { orphans, error: null };
}
