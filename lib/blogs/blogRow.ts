import { parseFaqSchemaInput } from '@/lib/blogs/faqSchema';

export type BlogBody = {
  title: string;
  slug: string;
  status?: 'draft' | 'published';
  meta_title?: string;
  description?: string;
  meta_description?: string;
  /** Schema.org datePublished */
  date_published: string;
  /** @deprecated legacy alias — use date_published */
  display_date?: string;
  cover_image_url?: string;
  content?: string;
  author_name?: string | null;
  keywords?: string | null;
  article_section?: string | null;
  in_language?: string | null;
  publisher_name?: string | null;
  publisher_logo_url?: string | null;
  canonical_url?: string | null;
  /** Schema.org mainEntityOfPage */
  main_entity_of_page?: string | null;
  category_id?: string | null;
  /** Schema.org FAQPage JSON — unique per blog, pasted by SEO */
  faq_schema?: string | Record<string, unknown> | unknown[] | null;
};

function resolveDatePublished(body: BlogBody): Date {
  const raw = body.date_published ?? body.display_date;
  if (!raw) {
    throw new Error('Invalid date_published format');
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date_published format');
  }
  return parsed;
}

function normalizeOptionalUuid(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export function buildBlogRow(siteId: string, body: BlogBody) {
  const now = new Date().toISOString();
  const status = body.status === 'draft' ? 'draft' : 'published';
  const datePublished = resolveDatePublished(body).toISOString();

  return {
    site_id: siteId,
    title: body.title,
    slug: body.slug,
    status,
    meta_title: body.meta_title ?? '',
    description: body.description ?? '',
    meta_description: body.meta_description ?? '',
    date_published: datePublished,
    date_modified: now,
    main_entity_of_page: body.main_entity_of_page?.trim() || null,
    cover_image_url: body.cover_image_url ?? '',
    content: body.content ?? '',
    author_name: body.author_name ?? null,
    keywords: body.keywords ?? null,
    article_section: body.article_section ?? null,
    in_language: body.in_language ?? null,
    publisher_name: body.publisher_name ?? null,
    publisher_logo_url: body.publisher_logo_url ?? null,
    canonical_url: body.canonical_url ?? null,
    category_id: normalizeOptionalUuid(body.category_id),
    faq_schema: parseFaqSchemaInput(body.faq_schema),
    updated_at: now,
  };
}

/** Columns to select when fetching blogs for public SEO / JSON-LD */
export const BLOG_SEO_SELECT =
  'id,site_id,status,title,slug,description,meta_description,meta_title,date_published,date_modified,main_entity_of_page,canonical_url,cover_image_url,category_id,author_name,keywords,in_language,publisher_name,publisher_logo_url,article_section,content,faq_schema';
