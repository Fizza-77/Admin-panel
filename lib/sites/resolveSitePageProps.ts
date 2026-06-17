import type { GetServerSidePropsContext } from 'next';
import { lookupSiteById, normalizeSiteId, countBlogsForSiteId } from '@/lib/sites/getSiteById';
import type { Site } from '@/types/site';

type SitePageContext = Pick<GetServerSidePropsContext, 'params'>;

export type ResolvedSitePage =
  | { kind: 'site'; site: Site }
  | { kind: 'redirect'; destination: string }
  | { kind: 'notFound' };

/**
 * Resolve a site for site-scoped pages. Redirects to recover flow when blogs exist but the sites row is missing.
 */
export async function resolveSitePage(context: SitePageContext): Promise<ResolvedSitePage> {
  const rawId = context.params?.siteId;
  const siteId = normalizeSiteId(typeof rawId === 'string' ? rawId : null);
  if (!siteId) {
    return { kind: 'notFound' };
  }

  const siteLookup = await lookupSiteById(siteId);
  if (siteLookup.ok) {
    return { kind: 'site', site: siteLookup.site };
  }
  if (siteLookup.reason === 'query_error') {
    return { kind: 'notFound' };
  }

  const blogCount = await countBlogsForSiteId(siteId);
  if (blogCount > 0) {
    return {
      kind: 'redirect',
      destination: `/sites/${siteId}/recover`,
    };
  }

  return { kind: 'notFound' };
}
