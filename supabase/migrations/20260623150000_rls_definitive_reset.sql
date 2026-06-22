-- Definitive RLS reset for Skyen Admin Panel (run once in Supabase SQL Editor).
--
-- Goals:
--   • Admin API uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS; explicit policies are belt-and-suspenders).
--   • Public websites use the anon key: read sites + categories; read published blogs only.
--   • No RESTRICTIVE policies (they stack with permissive and often deny all access when misconfigured).
--   • No anon/authenticated write policies on admin tables.
--
-- After running, verify:
--   SELECT policyname, roles, cmd, permissive FROM pg_policies
--   WHERE schemaname = 'public' AND tablename IN ('blogs','sites','blog_categories')
--   ORDER BY tablename, policyname;
--
--   SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'service_role';
--   -- rolbypassrls must be true (default on Supabase).

-- ═══════════════════════════════════════════════════════════════════════════
-- blogs
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blogs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.blogs', p.policyname);
    RAISE NOTICE 'Dropped blogs policy %', p.policyname;
  END LOOP;
END $$;

CREATE POLICY "service_role_all_blogs"
  ON public.blogs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "blogs_public_read_published"
  ON public.blogs
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

GRANT ALL ON public.blogs TO service_role;
GRANT SELECT ON public.blogs TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- sites
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sites'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sites', p.policyname);
    RAISE NOTICE 'Dropped sites policy %', p.policyname;
  END LOOP;
END $$;

CREATE POLICY "service_role_all_sites"
  ON public.sites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "sites_public_read"
  ON public.sites
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT ALL ON public.sites TO service_role;
GRANT SELECT ON public.sites TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- blog_categories
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_categories'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.blog_categories', p.policyname);
    RAISE NOTICE 'Dropped blog_categories policy %', p.policyname;
  END LOOP;
END $$;

CREATE POLICY "service_role_all_blog_categories"
  ON public.blog_categories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "blog_categories_public_read"
  ON public.blog_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT ALL ON public.blog_categories TO service_role;
GRANT SELECT ON public.blog_categories TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- blog_reactions (public read for published posts; admin manages via service_role)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.blog_reactions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blog_reactions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.blog_reactions', p.policyname);
    RAISE NOTICE 'Dropped blog_reactions policy %', p.policyname;
  END LOOP;
END $$;

CREATE POLICY "service_role_all_blog_reactions"
  ON public.blog_reactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "blog_reactions_public_read_published"
  ON public.blog_reactions
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.blogs b
      WHERE b.id = blog_reactions.blog_id AND b.status = 'published'
    )
  );

GRANT ALL ON public.blog_reactions TO service_role;
GRANT SELECT ON public.blog_reactions TO anon, authenticated;
