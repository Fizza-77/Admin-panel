-- Fix: after removing duplicate anon read policies, only a RESTRICTIVE policy remained.
-- PostgreSQL requires a PERMISSIVE policy to grant access; restrictive alone denies all anon reads.
-- Symptom: /api/health blogs.count=0, admin publish says "Blog not found".

DROP POLICY IF EXISTS "Public can read published blogs" ON public.blogs;

CREATE POLICY "Public can read published blogs"
  ON public.blogs
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');
