-- Run ONLY if you already applied an older migration where `blog_categories` had `site_id`
-- (one row per site per slug). This collapses to global categories and preserves post links by slug.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'blog_categories'
      AND column_name = 'site_id'
  ) THEN
    RAISE NOTICE 'blog_categories has no site_id — nothing to migrate.';
    RETURN;
  END IF;

  -- Drop FK from blogs so we can replace category ids
  ALTER TABLE public.blogs DROP CONSTRAINT IF EXISTS blogs_category_id_fkey;

  CREATE TABLE public.blog_categories_global (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  INSERT INTO public.blog_categories_global (slug, name, description, sort_order)
  SELECT DISTINCT ON (slug)
    slug,
    name,
    description,
    sort_order
  FROM public.blog_categories
  ORDER BY slug, sort_order;

  -- Point posts at the canonical global row for that slug
  UPDATE public.blogs b
  SET category_id = g.id
  FROM public.blog_categories old
  JOIN public.blog_categories_global g ON g.slug = old.slug
  WHERE b.category_id = old.id;

  DROP TABLE public.blog_categories;

  ALTER TABLE public.blog_categories_global RENAME TO blog_categories;

  ALTER TABLE public.blogs
    ADD CONSTRAINT blogs_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.blog_categories (id) ON DELETE SET NULL;

  ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Public read blog_categories" ON public.blog_categories;
  CREATE POLICY "Public read blog_categories"
    ON public.blog_categories
    FOR SELECT
    TO anon
    USING (true);

  -- Ensure seed rows exist (in case old data used different slugs)
  INSERT INTO public.blog_categories (slug, name, description, sort_order)
  VALUES
    ('lesson-planning', 'Lesson Planning', 'Practical guides and strategies for teachers', 1),
    ('curriculum-guides', 'Curriculum Guides', 'Curriculum-specific resources by system and country', 2),
    ('ai-in-education', 'AI in Education', 'Honest, research-grounded perspectives on AI in teaching', 3),
    ('teacher-wellbeing', 'Teacher Wellbeing', 'Workload, time management, and professional sustainability', 4),
    ('edtech', 'EdTech', 'Tools, trends, and what actually works in classrooms', 5)
  ON CONFLICT (slug) DO NOTHING;

  RAISE NOTICE 'Migrated blog_categories to global (no site_id).';
END $$;
