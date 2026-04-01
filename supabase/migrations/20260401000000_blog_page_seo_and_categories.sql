-- Blog listing page copy (per site), shared global categories, and post → category link.
-- Categories are the same for every website in this project.

-- ---------------------------------------------------------------------------
-- 1) Site: blog index page SEO + empty state (Make My Lesson defaults for studiely)
-- ---------------------------------------------------------------------------
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS blog_page_meta_title text,
  ADD COLUMN IF NOT EXISTS blog_page_meta_description text,
  ADD COLUMN IF NOT EXISTS blog_page_headline text,
  ADD COLUMN IF NOT EXISTS blog_page_subheadline text,
  ADD COLUMN IF NOT EXISTS blog_empty_state_message text;

COMMENT ON COLUMN public.sites.blog_page_meta_title IS 'HTML <title> for the public blog index page';
COMMENT ON COLUMN public.sites.blog_page_meta_description IS 'Meta description for the public blog index page';
COMMENT ON COLUMN public.sites.blog_page_headline IS 'H1-style headline on the public blog index page';
COMMENT ON COLUMN public.sites.blog_page_subheadline IS 'Supporting line under the headline';
COMMENT ON COLUMN public.sites.blog_empty_state_message IS 'Copy when no posts exist yet';

-- Default copy for Make My Lesson (adjust site_key if needed)
UPDATE public.sites
SET
  blog_page_meta_title = COALESCE(NULLIF(TRIM(blog_page_meta_title), ''), 'The Make My Lesson Blog — Teaching, Planning, and AI in Education'),
  blog_page_meta_description = COALESCE(
    NULLIF(TRIM(blog_page_meta_description), ''),
    'Insights, guides, and research-backed articles for teachers on lesson planning, curriculum alignment, AI in education, and making more time for what matters most.'
  ),
  blog_page_headline = COALESCE(NULLIF(TRIM(blog_page_headline), ''), 'Resources for Teachers Who Take Their Practice Seriously.'),
  blog_page_subheadline = COALESCE(
    NULLIF(TRIM(blog_page_subheadline), ''),
    'Articles, guides, and research on lesson planning, curriculum alignment, AI in education, and reclaiming time for the work that only you can do.'
  ),
  blog_empty_state_message = COALESCE(
    NULLIF(TRIM(blog_empty_state_message), ''),
    'We are still writing. The first articles are on their way — covering lesson planning, curriculum insights, and honest perspectives on AI in education. Check back soon.'
  )
WHERE site_key = 'studiely';

-- ---------------------------------------------------------------------------
-- 2) Global blog categories (shared by all sites)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.blog_categories (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS blogs_category_id_idx ON public.blogs (category_id);

COMMENT ON TABLE public.blog_categories IS 'Shared blog taxonomy for all sites (listing / SEO)';

INSERT INTO public.blog_categories (slug, name, description, sort_order)
VALUES
  ('lesson-planning', 'Lesson Planning', 'Practical guides and strategies for teachers', 1),
  ('curriculum-guides', 'Curriculum Guides', 'Curriculum-specific resources by system and country', 2),
  ('ai-in-education', 'AI in Education', 'Honest, research-grounded perspectives on AI in teaching', 3),
  ('teacher-wellbeing', 'Teacher Wellbeing', 'Workload, time management, and professional sustainability', 4),
  ('edtech', 'EdTech', 'Tools, trends, and what actually works in classrooms', 5)
ON CONFLICT (slug) DO NOTHING;

-- Map existing posts from legacy article_section text to global category by name match
UPDATE public.blogs b
SET category_id = c.id
FROM public.blog_categories c
WHERE b.category_id IS NULL
  AND b.article_section IS NOT NULL
  AND length(trim(b.article_section)) > 0
  AND lower(trim(b.article_section)) = lower(trim(c.name));

-- ---------------------------------------------------------------------------
-- 3) RLS (if you use anon reads on the website)
-- ---------------------------------------------------------------------------
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read blog_categories" ON public.blog_categories;
CREATE POLICY "Public read blog_categories"
  ON public.blog_categories
  FOR SELECT
  TO anon
  USING (true);
