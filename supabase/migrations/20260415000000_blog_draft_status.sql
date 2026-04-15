-- Add draft/publish status to blogs so admins can save work before publishing.

ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.blogs
SET status = 'published'
WHERE status IS NULL OR btrim(status) = '';

ALTER TABLE public.blogs
  ALTER COLUMN status SET DEFAULT 'published';

ALTER TABLE public.blogs
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blogs_status_check'
      AND conrelid = 'public.blogs'::regclass
  ) THEN
    ALTER TABLE public.blogs
      ADD CONSTRAINT blogs_status_check CHECK (status IN ('draft', 'published'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS blogs_site_status_display_date_idx
  ON public.blogs (site_id, status, display_date DESC);

COMMENT ON COLUMN public.blogs.status IS 'Publication status for admin workflow: draft or published.';
