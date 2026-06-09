import { supabase } from '@/lib/supabase/server';
import type { BlogCategory } from '@/types/blogCategory';
import { dataLoadFailure, dataLoadSuccess, type DataLoadState } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

/**
 * List blog categories for a site. Surfaces query errors instead of returning [].
 */
export async function listCategoriesForSite(siteId: string): Promise<DataLoadState<BlogCategory[]>> {
  const { data, error } = await supabase
    .from('blog_categories')
    .select('id,site_id,slug,name,description,sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: true });

  if (error) {
    reportError(error, { source: 'listCategoriesForSite', siteId });
    return dataLoadFailure([], error);
  }

  return dataLoadSuccess((data ?? []) as BlogCategory[]);
}
