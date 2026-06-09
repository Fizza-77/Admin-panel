import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/server';
import { formatDbError, isMissingColumnError } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import type { Site } from '@/types/site';

function isMissingCreatedAt(error: PostgrestError | null): boolean {
  return isMissingColumnError(error, 'created_at');
}

export type SitesLoadResult = {
  sites: Site[];
  error: string | null;
  warning: string | null;
  dbError: PostgrestError | null;
};

export async function listSites(): Promise<SitesLoadResult> {
  const orderedByCreatedAt = await supabase
    .from('sites')
    .select('id,name,domain,site_key')
    .order('created_at', { ascending: true });

  if (!orderedByCreatedAt.error) {
    const sites = orderedByCreatedAt.data ?? [];
    return { sites, error: null, warning: null, dbError: null };
  }

  reportError(orderedByCreatedAt.error, {
    source: 'listSites.primary',
    code: orderedByCreatedAt.error.code,
  });

  const fallback = isMissingCreatedAt(orderedByCreatedAt.error)
    ? await supabase.from('sites').select('id,name,domain,site_key').order('id', { ascending: true })
    : await supabase.from('sites').select('id,name,domain,site_key');

  if (!fallback.error) {
    const sites = fallback.data ?? [];
    const warning = `Primary sites query failed; used fallback: ${formatDbError(orderedByCreatedAt.error)}`;
    reportError(new Error(warning), { source: 'listSites.fallback', severity: 'warning' });
    return {
      sites,
      error: null,
      warning,
      dbError: null,
    };
  }

  reportError(fallback.error, { source: 'listSites.fallbackFailed' });

  return {
    sites: [],
    error: formatDbError(fallback.error),
    warning: null,
    dbError: fallback.error,
  };
}

export async function findDefaultSite(defaultSiteKey?: string): Promise<{
  siteId: string | null;
  error: string | null;
}> {
  const { sites, error } = await listSites();
  if (error) {
    return { siteId: null, error };
  }

  if (defaultSiteKey) {
    const match = sites.find((site) => site.site_key === defaultSiteKey);
    return { siteId: match?.id ?? null, error: null };
  }

  return { siteId: sites[0]?.id ?? null, error: null };
}
