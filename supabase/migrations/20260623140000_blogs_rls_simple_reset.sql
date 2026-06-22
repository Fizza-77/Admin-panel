-- Reset blogs RLS to a minimal, non-conflicting set.
-- Do NOT combine RESTRICTIVE + PERMISSIVE with the same rule — use one permissive SELECT only.
-- Admin panel: service_role (full access). Public websites: anon reads published only.

-- ─── Remove every existing blogs policy ───
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blogs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.blogs', p.policyname);
    RAISE NOTICE 'Dropped policy % on public.blogs', p.policyname;
  END LOOP;
END $$;

-- ─── 1) Admin API (service_role JWT) — read + write ───
CREATE POLICY "service_role_all_blogs"
  ON public.blogs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 2) Public websites (anon key) — read published posts only ───
CREATE POLICY "blogs_public_read_published"
  ON public.blogs
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- ─── Verify (should show exactly 2 policies) ───
-- SELECT policyname, roles, cmd, permissive FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'blogs' ORDER BY policyname;
