export type BlogBody = {
  title: string;
  slug: string;
  status?: 'draft' | 'published';
  meta_title?: string;
  description?: string;
  meta_description?: string;
  display_date: string;
  cover_image_url?: string;
  content?: string;
  author_name?: string | null;
  keywords?: string | null;
  article_section?: string | null;
  in_language?: string | null;
  publisher_name?: string | null;
  publisher_logo_url?: string | null;
  canonical_url?: string | null;
  category_id?: string | null;
};

export function buildBlogRow(siteId: string, body: BlogBody) {
  const now = new Date().toISOString();
  const status = body.status === 'draft' ? 'draft' : 'published';
  const parsedDisplayDate = new Date(body.display_date);
  if (Number.isNaN(parsedDisplayDate.getTime())) {
    throw new Error('Invalid display_date format');
  }

  return {
    site_id: siteId,
    title: body.title,
    slug: body.slug,
    status,
    meta_title: body.meta_title ?? '',
    description: body.description ?? '',
    meta_description: body.meta_description ?? '',
    display_date: parsedDisplayDate.toISOString(),
    cover_image_url: body.cover_image_url ?? '',
    content: body.content ?? '',
    author_name: body.author_name ?? null,
    keywords: body.keywords ?? null,
    article_section: body.article_section ?? null,
    in_language: body.in_language ?? null,
    publisher_name: body.publisher_name ?? null,
    publisher_logo_url: body.publisher_logo_url ?? null,
    canonical_url: body.canonical_url ?? null,
    category_id: body.category_id ?? null,
    updated_at: now,
  };
}
