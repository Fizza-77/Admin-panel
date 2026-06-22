-- Admin panel blog writes: explicit service_role access + clean accidental anon write policies.
-- The admin API uses SUPABASE_SERVICE_ROLE_KEY; PostgREST normally bypasses RLS for that JWT.
-- Run this if updates return "no rows changed" while reads still work.

-- ─── 1) Audit (optional — run alone first to inspect) ───
-- SELECT policyname, roles, cmd, permissive, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'blogs'
-- ORDER BY cmd, policyname;

-- ─── 2) Remove anon/authenticated WRITE policies on blogs (admin must not write via anon) ───
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blogs'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (
        'anon' = ANY (roles)
        OR 'authenticated' = ANY (roles)
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.blogs', p.policyname);
    RAISE NOTICE 'Dropped write policy % on public.blogs', p.policyname;
  END LOOP;
END $$;

-- ─── 3) Public read: published posts only (websites) — permissive ONLY (no restrictive) ───
DROP POLICY IF EXISTS "Public can read blogs" ON public.blogs;
DROP POLICY IF EXISTS "Public can read published blogs" ON public.blogs;
DROP POLICY IF EXISTS "Anon can read published blogs only" ON public.blogs;

CREATE POLICY "blogs_public_read_published"
  ON public.blogs
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- ─── 4) Explicit full access for service_role (admin panel) ───
DROP POLICY IF EXISTS "service_role_all_blogs" ON public.blogs;
CREATE POLICY "service_role_all_blogs"
  ON public.blogs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 5) Same pattern for sites + blog_categories (reads for public, writes via admin) ───
DROP POLICY IF EXISTS "Public can read sites for integration" ON public.sites;
CREATE POLICY "Public can read sites for integration"
  ON public.sites
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "service_role_all_sites" ON public.sites;
CREATE POLICY "service_role_all_sites"
  ON public.sites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public read blog_categories" ON public.blog_categories;
CREATE POLICY "Public read blog_categories"
  ON public.blog_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "service_role_all_blog_categories" ON public.blog_categories;
CREATE POLICY "service_role_all_blog_categories"
  ON public.blog_categories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
