-- Ensure public websites and misconfigured admin clients can read sites + blog_categories.
-- Admin panel should use service_role (bypasses RLS); these policies fix empty reads when
-- the server accidentally uses the anon key or when public sites resolve SITE_KEY.

DROP POLICY IF EXISTS "Public can read sites for integration" ON public.sites;
CREATE POLICY "Public can read sites for integration"
  ON public.sites
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public read blog_categories" ON public.blog_categories;
CREATE POLICY "Public read blog_categories"
  ON public.blog_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);
