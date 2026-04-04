-- Legacy file: global → per-site migration is now handled inside
-- `20260401000000_blog_page_seo_and_categories.sql` (DO block when `site_id` is missing).
-- Kept so migration order stays stable; safe to run (no-op).

SELECT 1;
