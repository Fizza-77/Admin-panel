-- Enforce published-only visibility for public (anon) readers.
-- This prevents draft posts from leaking even if client code forgets to filter by status.

ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'blogs'
      AND policyname = 'Anon can read published blogs only'
  ) THEN
    CREATE POLICY "Anon can read published blogs only"
      ON public.blogs
      AS RESTRICTIVE
      FOR SELECT
      TO anon
      USING (status = 'published');
  END IF;
END $$;
