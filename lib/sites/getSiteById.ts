import { supabase } from '@/lib/supabase/server';
import { formatDbError, isUndefinedColumnError } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import type { Site } from '@/types/site';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BASIC_SITE_COLUMNS = 'id,name,domain,site_key';
const FULL_SITE_COLUMNS =
  'id,name,domain,site_key,blog_page_meta_title,blog_page_meta_description,blog_page_headline,blog_page_subheadline,blog_empty_state_message';

export function normalizeSiteId(siteId: string | undefined | null): string | null {
  if (typeof siteId !== 'string') {
    return null;
  }
  const trimmed = siteId.trim();
  if (!trimmed || !UUID_RE.test(trimmed)) {
    return null;
  }
  return trimmed.toLowerCase();
}

export type SiteLookupResult =
  | { ok: true; site: Site }
  | { ok: false; reason: 'invalid_id' | 'not_found' | 'query_error'; message: string };

export async function lookupSiteById(siteId: string): Promise<SiteLookupResult> {
  const normalized = normalizeSiteId(siteId);
  if (!normalized) {
    return { ok: false, reason: 'invalid_id', message: 'Invalid site id' };
  }

  const full = await supabase.from('sites').select(FULL_SITE_COLUMNS).eq('id', normalized).maybeSingle();
  if (!full.error && full.data) {
    return { ok: true, site: full.data as Site };
  }

  if (full.error && !isUndefinedColumnError(full.error)) {
    reportError(full.error, { source: 'lookupSiteById.full', siteId: normalized });
    return { ok: false, reason: 'query_error', message: formatDbError(full.error) };
  }

  const basic = await supabase.from('sites').select(BASIC_SITE_COLUMNS).eq('id', normalized).maybeSingle();
  if (basic.error) {
    reportError(basic.error, { source: 'lookupSiteById.basic', siteId: normalized });
    return { ok: false, reason: 'query_error', message: formatDbError(basic.error) };
  }

  if (!basic.data) {
    return { ok: false, reason: 'not_found', message: 'Site not found' };
  }

  return { ok: true, site: basic.data as Site };
}

/** @deprecated Prefer lookupSiteById — this swallows query errors as null. */
export async function getSiteById(siteId: string): Promise<Site | null> {
  const result = await lookupSiteById(siteId);
  return result.ok ? result.site : null;
}

export async function countBlogsForSiteId(siteId: string): Promise<number> {
  const normalized = normalizeSiteId(siteId);
  if (!normalized) {
    return 0;
  }

  const { count, error } = await supabase
    .from('blogs')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', normalized);

  if (error) {
    reportError(error, { source: 'countBlogsForSiteId', siteId: normalized });
    return 0;
  }

  return count ?? 0;
}
