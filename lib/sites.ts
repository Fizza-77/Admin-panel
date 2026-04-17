import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/server';
import type { Site } from '@/types/site';

function isMissingCreatedAt(error: PostgrestError | null): boolean {
  if (!error) return false;
  return error.code === '42703' || /created_at/i.test(error.message);
}

export async function listSites(): Promise<{ sites: Site[]; error: PostgrestError | null }> {
  const orderedByCreatedAt = await supabase
    .from('sites')
    .select('id,name,domain,site_key')
    .order('created_at', { ascending: true });

  if (!orderedByCreatedAt.error) {
    const sites = orderedByCreatedAt.data ?? [];
    console.log(`Loaded ${sites.length} sites (${sites.filter(s => s.site_key).length} connected)`);
    return { sites, error: null };
  }

  // Some older databases may not have `created_at`; gracefully fall back.
  if (isMissingCreatedAt(orderedByCreatedAt.error)) {
    const fallback = await supabase.from('sites').select('id,name,domain,site_key').order('id', { ascending: true });
    const sites = fallback.data ?? [];
    console.log(`Loaded ${sites.length} sites via fallback (${sites.filter(s => s.site_key).length} connected)`);
    return {
      sites,
      error: fallback.error,
    };
  }

  return {
    sites: [],
    error: orderedByCreatedAt.error,
  };
}

export async function findDefaultSite(defaultSiteKey?: string): Promise<{ siteId: string | null; error: PostgrestError | null }> {
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
