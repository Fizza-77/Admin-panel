/**
 * Copy these helpers into your public website (e.g. Make My Lesson).
 * They use the anon Supabase client and assume RLS allows SELECT on `sites`, `blogs`, and `blog_categories`.
 * Reaction counts are fetched server-side from the admin API, not statically or in the browser.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SITE_KEY (or SITE_ID / NEXT_PUBLIC_SITE_ID), NEXT_PUBLIC_ADMIN_API_BASE_URL.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BLOG_SEO_SELECT } from '@/lib/blogs/blogRow';

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
  meta_title: string | null;
  /** Schema.org datePublished */
  date_published: string;
  /** Schema.org dateModified */
  date_modified: string | null;
  /** Schema.org mainEntityOfPage */
  main_entity_of_page: string | null;
  canonical_url: string | null;
  cover_image_url: string | null;
  category_id: string | null;
  author_name: string | null;
  keywords: string | null;
  in_language: string | null;
  publisher_name: string | null;
  publisher_logo_url: string | null;
  article_section: string | null;
  content: string | null;
  /** Per-article FAQ schema JSON — unique to this blog (SEO-provided) */
  faq_schema: Record<string, unknown> | unknown[] | null;
};

/** FAQ JSON-LD already stored on the blog row — output as-is on the article page. */
export function getBlogFaqJsonLd(blog: Pick<BlogPostRow, 'faq_schema'>) {
  if (!blog.faq_schema || (typeof blog.faq_schema === 'object' && Object.keys(blog.faq_schema).length === 0)) {
    return null;
  }
  return blog.faq_schema;
}

export type ReactionType = 'love' | 'thumbs_up' | 'thumbs_down' | 'celebrationpop' | 'clap';

export type ReactionCounts = Record<ReactionType, number>;

export const EMPTY_REACTION_COUNTS: ReactionCounts = {
  love: 0,
  thumbs_up: 0,
  thumbs_down: 0,
  celebrationpop: 0,
  clap: 0,
};

export type BlogReactionState = {
  counts: ReactionCounts;
  userReaction: ReactionType | null;
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

/** Blog listing with full SEO / Schema.org fields for JSON-LD. */
export async function getBlogsForSite(supabase: SupabaseClient, siteId: string): Promise<BlogWithCategory[]> {
  const [{ data: blogs, error: blogsError }, { data: cats }] = await Promise.all([
    supabase
      .from('blogs')
      .select(BLOG_SEO_SELECT)
      .eq('site_id', siteId)
      .eq('status', 'published')
      .order('date_published', { ascending: false }),
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

export async function getReactionCountsForBlog(adminApiBaseUrl: string, blogId: string): Promise<BlogReactionState> {
  const response = await fetch(`${adminApiBaseUrl}/api/public/blogs/${blogId}/reactions`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    return {
      counts: { ...EMPTY_REACTION_COUNTS },
      userReaction: null,
    };
  }

  const body = (await response.json().catch(() => ({}))) as Partial<BlogReactionState>;
  const counts = body?.counts ?? EMPTY_REACTION_COUNTS;

  return {
    counts: {
      love: Number(counts.love ?? 0),
      thumbs_up: Number(counts.thumbs_up ?? 0),
      thumbs_down: Number(counts.thumbs_down ?? 0),
      celebrationpop: Number(counts.celebrationpop ?? 0),
      clap: Number(counts.clap ?? 0),
    },
    userReaction: body?.userReaction ?? null,
  };
}

export async function getReactionCountsForBlogs(adminApiBaseUrl: string, blogIds: string[]) {
  const uniqueBlogIds = Array.from(new Set((Array.isArray(blogIds) ? blogIds : []).filter(Boolean)));
  const entries = await Promise.all(
    uniqueBlogIds.map(async (blogId) => {
      const state = await getReactionCountsForBlog(adminApiBaseUrl, blogId);
      return [blogId, state] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<string, BlogReactionState>;
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

/** Convenience: resolve SITE_KEY → siteId → copy + categories + posts + SSR reaction counts */
export async function getBlogIndexPageDataWithReactions(
  supabase: SupabaseClient,
  siteKey: string,
  adminApiBaseUrl: string,
) {
  const base = await getBlogIndexPageData(supabase, siteKey);
  const reactionCountsByBlog = await getReactionCountsForBlogs(
    adminApiBaseUrl,
    base.blogs.map((blog) => blog.id),
  );

  return {
    ...base,
    reactionCountsByBlog,
  };
}
