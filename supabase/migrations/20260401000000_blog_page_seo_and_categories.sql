-- Blog listing page copy (per site), per-site categories, and post → category link.
-- Safe if `blog_categories` already exists as a legacy GLOBAL table (no site_id): it upgrades first.

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
-- 2) blog_categories: create new table OR upgrade legacy global table (add site_id)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'blog_categories'
  ) THEN
    CREATE TABLE public.blog_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE,
      slug text NOT NULL,
      name text NOT NULL,
      description text,
      sort_order int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (site_id, slug)
    );
    CREATE INDEX blog_categories_site_id_idx ON public.blog_categories (site_id);
    RAISE NOTICE 'Created blog_categories (per-site).';

  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'blog_categories' AND column_name = 'site_id'
  ) THEN
    RAISE NOTICE 'Upgrading legacy blog_categories (adding site_id)...';

    ALTER TABLE public.blogs DROP CONSTRAINT IF EXISTS blogs_category_id_fkey;

    ALTER TABLE public.blog_categories
      ADD COLUMN site_id uuid REFERENCES public.sites (id) ON DELETE CASCADE;

    -- Legacy table often has UNIQUE(slug) globally — must drop before duplicating per site
    ALTER TABLE public.blog_categories DROP CONSTRAINT IF EXISTS blog_categories_slug_key;
    DROP INDEX IF EXISTS blog_categories_slug_key;

    INSERT INTO public.blog_categories (site_id, slug, name, description, sort_order)
    SELECT s.id, g.slug, g.name, g.description, g.sort_order
    FROM public.sites s
    CROSS JOIN public.blog_categories g
    WHERE g.site_id IS NULL;

    UPDATE public.blogs b
    SET category_id = nc.id
    FROM public.blog_categories oc
    JOIN public.blog_categories nc ON nc.site_id = b.site_id AND nc.slug = oc.slug
    WHERE b.category_id = oc.id AND oc.site_id IS NULL;

    UPDATE public.blogs b
    SET category_id = NULL
    FROM public.blog_categories oc
    WHERE b.category_id = oc.id AND oc.site_id IS NULL;

    DELETE FROM public.blog_categories WHERE site_id IS NULL;

    ALTER TABLE public.blog_categories ALTER COLUMN site_id SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS blog_categories_site_id_slug_key ON public.blog_categories (site_id, slug);

    CREATE INDEX IF NOT EXISTS blog_categories_site_id_idx ON public.blog_categories (site_id);

    ALTER TABLE public.blogs
      ADD CONSTRAINT blogs_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.blog_categories (id) ON DELETE SET NULL;

    RAISE NOTICE 'Upgraded blog_categories to per-site.';
  ELSE
    CREATE INDEX IF NOT EXISTS blog_categories_site_id_idx ON public.blog_categories (site_id);
    RAISE NOTICE 'blog_categories already has site_id — OK.';
  END IF;
END $$;

ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.blog_categories (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS blogs_category_id_idx ON public.blogs (category_id);

COMMENT ON TABLE public.blog_categories IS 'Blog taxonomy scoped per site (listing / SEO)';

INSERT INTO public.blog_categories (site_id, slug, name, description, sort_order)
SELECT
  s.id,
  v.slug,
  v.name,
  v.description,
  v.sort_order
FROM public.sites s
CROSS JOIN (
  VALUES
    ('lesson-planning', 'Lesson Planning', 'Practical guides and strategies for teachers', 1),
    ('curriculum-guides', 'Curriculum Guides', 'Curriculum-specific resources by system and country', 2),
    ('ai-in-education', 'AI in Education', 'Honest, research-grounded perspectives on AI in teaching', 3),
    ('teacher-wellbeing', 'Teacher Wellbeing', 'Workload, time management, and professional sustainability', 4),
    ('edtech', 'EdTech', 'Tools, trends, and what actually works in classrooms', 5)
) AS v (slug, name, description, sort_order)
ON CONFLICT (site_id, slug) DO NOTHING;

UPDATE public.blogs b
SET category_id = c.id
FROM public.blog_categories c
WHERE b.site_id = c.site_id
  AND b.category_id IS NULL
  AND b.article_section IS NOT NULL
  AND length(trim(b.article_section)) > 0
  AND lower(trim(b.article_section)) = lower(trim(c.name));

-- ---------------------------------------------------------------------------
-- 3) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read blog_categories" ON public.blog_categories;
CREATE POLICY "Public read blog_categories"
  ON public.blog_categories
  FOR SELECT
  TO anon
  USING (true);
