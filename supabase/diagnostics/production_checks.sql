-- Production diagnostics for Skyen Admin Panel
-- Run in Supabase SQL Editor against the production project.

-- 1) Auth users without app_profiles rows
SELECT
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at
FROM auth.users u
LEFT JOIN public.app_profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ORDER BY u.created_at DESC;

SELECT count(*) AS users_without_profiles
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_profiles p WHERE p.user_id = u.id
);

-- 2) Missing permission columns on app_profiles
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_profiles'
ORDER BY ordinal_position;

-- Expected columns (compare manually):
-- user_id, can_manage_blogs, can_manage_tasks, can_administer_tasks,
-- can_manage_users, display_name, created_at, updated_at

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_profiles'
  AND column_name IN (
    'can_manage_blogs',
    'can_manage_tasks',
    'can_administer_tasks',
    'can_manage_users',
    'display_name'
  )
ORDER BY column_name;

-- 3) Null permission values (should not happen on NOT NULL columns)
SELECT
  user_id,
  can_manage_blogs,
  can_manage_tasks,
  can_administer_tasks,
  can_manage_users,
  display_name
FROM public.app_profiles
WHERE can_manage_blogs IS NULL
   OR can_manage_tasks IS NULL
   OR can_administer_tasks IS NULL
   OR can_manage_users IS NULL;

-- 4) Duplicate profile rows (should be impossible with PK on user_id)
SELECT user_id, count(*) AS row_count
FROM public.app_profiles
GROUP BY user_id
HAVING count(*) > 1;

-- 5) Foreign key integrity — orphan profiles (no auth user)
SELECT p.user_id, p.can_manage_blogs, p.can_manage_tasks, p.can_administer_tasks
FROM public.app_profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE u.id IS NULL;

-- 6) Blog schema columns used by admin listing
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'blogs'
  AND column_name IN (
    'date_published',
    'display_date',
    'date_modified',
    'main_entity_of_page',
    'faq_schema',
    'created_at'
  )
ORDER BY column_name;

-- 7) Quick row counts
SELECT 'sites' AS table_name, count(*) FROM public.sites
UNION ALL
SELECT 'blogs', count(*) FROM public.blogs
UNION ALL
SELECT 'app_profiles', count(*) FROM public.app_profiles
UNION ALL
SELECT 'blog_categories', count(*) FROM public.blog_categories;

-- 7b) Blogs whose site_id has no row in public.sites (orphaned — causes "Site not found" on new blog)
SELECT
  b.site_id,
  count(*) AS blog_count
FROM public.blogs b
LEFT JOIN public.sites s ON s.id = b.site_id
WHERE s.id IS NULL
GROUP BY b.site_id
ORDER BY blog_count DESC;

-- 8) Users with all permissions false (legitimate vs missing bootstrap)
SELECT
  u.email,
  p.can_manage_blogs,
  p.can_manage_tasks,
  p.can_administer_tasks,
  p.can_manage_users,
  p.updated_at
FROM public.app_profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE p.can_manage_blogs = false
  AND p.can_manage_tasks = false
  AND p.can_administer_tasks = false
  AND p.can_manage_users = false
ORDER BY p.updated_at DESC;
