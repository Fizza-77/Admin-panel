/**
 * Copy these helpers into your public website (e.g. Make My Lesson).
 * They use the anon Supabase client and assume RLS allows SELECT on `sites`, `blogs`, and `blog_categories`.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SITE_KEY (or SITE_ID / NEXT_PUBLIC_SITE_ID).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type SiteBlogPageCopy = {
  blog_page_meta_title: string | null;
  blog_page_meta_description: string | null;
  blog_page_headline: string | null;
  blog_page_subheadline: string | null;
  blog_empty_state_message: string | null;
};

export type BlogCategoryRow = {
  id: string;
  site_id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
};

export type BlogPostRow = {
  id: string;
  site_id: string;
  status: 'draft' | 'published';
  title: string;
  slug: string;
  description: string | null;
  meta_description: string | null;
  display_date: string;
  cover_image_url: string | null;
  category_id: string | null;
};

export function createPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient(url, key);
}

export async function getSiteIdByKey(supabase: SupabaseClient, siteKey: string): Promise<string> {
  const fromEnv = process.env.SITE_ID || process.env.NEXT_PUBLIC_SITE_ID;
  if (fromEnv?.trim()) {
    return fromEnv.trim();
  }

  const { data, error } = await supabase.from('sites').select('id').eq('site_key', siteKey).single();

  if (error || !data?.id) {
    throw new Error(
      `Failed to resolve site_id for site_key "${siteKey}". Set SITE_ID or NEXT_PUBLIC_SITE_ID, or add a SELECT policy for the sites row.`,
    );
  }

  return data.id;
}

/** Blog index page: title, meta, hero, empty state — from `sites` row */
export async function getSiteBlogPageCopy(
  supabase: SupabaseClient,
  siteId: string,
): Promise<SiteBlogPageCopy | null> {
  const { data, error } = await supabase
    .from('sites')
    .select(
      'blog_page_meta_title, blog_page_meta_description, blog_page_headline, blog_page_subheadline, blog_empty_state_message',
    )
    .eq('id', siteId)
    .single();

  if (error || !data) return null;
  return data as SiteBlogPageCopy;
}

/** Categories for one connected site only */
export async function getBlogCategories(
  supabase: SupabaseClient,
  siteId: string,
): Promise<BlogCategoryRow[]> {
  const { data, error } = await supabase
    .from('blog_categories')
    .select('id,site_id,slug,name,description,sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (Array.isArray(data) ? data : []) as BlogCategoryRow[];
}

export type BlogWithCategory = BlogPostRow & {
  category: Pick<BlogCategoryRow, 'id' | 'slug' | 'name' | 'description'> | null;
};

/** Blog listing; merges `blog_categories` in memory (avoids brittle embed names). */
export async function getBlogsForSite(supabase: SupabaseClient, siteId: string): Promise<BlogWithCategory[]> {
  const [{ data: blogs, error: blogsError }, { data: cats }] = await Promise.all([
    supabase
      .from('blogs')
      .select('id,site_id,status,title,slug,description,meta_description,display_date,cover_image_url,category_id')
      .eq('site_id', siteId)
      .eq('status', 'published')
      .order('display_date', { ascending: false }),
    supabase.from('blog_categories').select('id,site_id,slug,name,description').eq('site_id', siteId),
  ]);

  if (blogsError) throw blogsError;

  const safeCats = Array.isArray(cats) ? cats : [];
  const safeBlogs = Array.isArray(blogs) ? blogs : [];
  const catMap = new Map(safeCats.map((c) => [c.id, c]));

  return safeBlogs.map((b) => ({
    ...(b as BlogPostRow),
    category: b.category_id ? catMap.get(b.category_id) ?? null : null,
  }));
}

/** Convenience: resolve SITE_KEY → siteId → copy + categories + posts */
export async function getBlogIndexPageData(supabase: SupabaseClient, siteKey: string) {
  const siteId = await getSiteIdByKey(supabase, siteKey);
  const [copy, categories, blogs] = await Promise.all([
    getSiteBlogPageCopy(supabase, siteId),
    getBlogCategories(supabase, siteId),
    getBlogsForSite(supabase, siteId),
  ]);
  return { siteId, copy, categories, blogs };
}
