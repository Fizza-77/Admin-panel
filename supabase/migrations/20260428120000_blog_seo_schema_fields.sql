-- Blog SEO / Schema.org columns: date_published, date_modified, main_entity_of_page
-- Migrates legacy display_date → date_published when present.

DO $$
BEGIN
  -- date_published: rename display_date, or merge if both exist, or add fresh
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'blogs' AND column_name = 'display_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'blogs' AND column_name = 'date_published'
  ) THEN
    ALTER TABLE public.blogs RENAME COLUMN display_date TO date_published;
    RAISE NOTICE 'Renamed blogs.display_date → date_published';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'blogs' AND column_name = 'display_date'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'blogs' AND column_name = 'date_published'
  ) THEN
    UPDATE public.blogs
    SET date_published = COALESCE(date_published, display_date)
    WHERE display_date IS NOT NULL;
    ALTER TABLE public.blogs DROP COLUMN display_date;
    RAISE NOTICE 'Merged blogs.display_date into date_published and dropped display_date';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'blogs' AND column_name = 'date_published'
  ) THEN
    ALTER TABLE public.blogs ADD COLUMN date_published timestamptz NOT NULL DEFAULT now();
    RAISE NOTICE 'Added blogs.date_published';
  END IF;
END $$;

ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS date_modified timestamptz,
  ADD COLUMN IF NOT EXISTS main_entity_of_page text;

-- Backfill date_modified from updated_at / created_at / date_published
UPDATE public.blogs
SET date_modified = COALESCE(date_modified, updated_at, created_at, date_published, now())
WHERE date_modified IS NULL;

COMMENT ON COLUMN public.blogs.date_published IS 'Schema.org datePublished — when the post was published';
COMMENT ON COLUMN public.blogs.date_modified IS 'Schema.org dateModified — last content/SEO update';
COMMENT ON COLUMN public.blogs.main_entity_of_page IS 'Schema.org mainEntityOfPage — canonical page URL for the article';

DROP INDEX IF EXISTS blogs_site_status_display_date_idx;
CREATE INDEX IF NOT EXISTS blogs_site_status_date_published_idx
  ON public.blogs (site_id, status, date_published DESC);
