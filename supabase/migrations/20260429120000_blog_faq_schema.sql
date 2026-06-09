-- Per-blog FAQ schema (Schema.org FAQPage) — unique to each blog row.

ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS faq_schema jsonb;

COMMENT ON COLUMN public.blogs.faq_schema IS
  'Schema.org FAQPage JSON for this post only — pasted by SEO, unique per blog row.';
