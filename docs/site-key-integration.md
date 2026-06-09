# Site Key Integration Guide

Use `site_key` as the stable tenant identifier in frontend/backend integrations.

## 1) Required env vars (website project)

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SITE_KEY=studiely
```

## 2) Resolve site once by `site_key`

```ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function getSiteIdByKey(siteKey: string): Promise<string> {
  const { data: site, error } = await supabase
    .from('sites')
    .select('id')
    .eq('site_key', siteKey)
    .single();

  if (error || !site) {
    throw new Error(`Site not found for key: ${siteKey}`);
  }

  return site.id;
}
```

## 3) Fetch blogs using `site_id`

```ts
export async function getBlogsForSite(siteId: string) {
  const { data: blogs, error } = await supabase
    .from('blogs')
    .select('*')
    .eq('site_id', siteId)
    .order('date_published', { ascending: false });

  if (error) throw error;
  return blogs ?? [];
}
```

## 4) SSR reactions pattern (Next.js)

Fetch reaction counts on the server during `getServerSideProps`, not in the browser and not with static generation.

```ts
import { getBlogIndexPageDataWithReactions } from '@/lib/blogs';

export const getServerSideProps = async () => {
  const supabase = createPublicSupabase();
  const siteKey = process.env.SITE_KEY;
  const adminApiBaseUrl = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL;

  if (!siteKey || !adminApiBaseUrl) {
    throw new Error('Missing SITE_KEY or NEXT_PUBLIC_ADMIN_API_BASE_URL');
  }

  const data = await getBlogIndexPageDataWithReactions(supabase, siteKey, adminApiBaseUrl);

  return {
    props: {
      ...data,
    },
  };
};
```

If you only need counts for one post:

```ts
import { getReactionCountsForBlog } from '@/lib/blogs';

export const getServerSideProps = async () => {
  const adminApiBaseUrl = process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL!;
  const reactionState = await getReactionCountsForBlog(adminApiBaseUrl, blogId);

  return {
    props: {
      reactionState,
    },
  };
};
```

## 5) Recommended server-side API pattern (Next.js)

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSiteIdByKey, getBlogsForSite } from '@/lib/blogs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const siteKey = process.env.SITE_KEY;
    if (!siteKey) {
      return res.status(500).json({ message: 'Missing SITE_KEY' });
    }

    const siteId = await getSiteIdByKey(siteKey);
    const blogs = await getBlogsForSite(siteId);
    return res.status(200).json({ blogs });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Failed to load blogs' });
  }
}
```

## Localhost troubleshooting

If your local site is not fetching blog data from Supabase:

1. Set a stable `SITE_KEY` in the local app `.env.local`.
2. If you do not want anon to read `sites`, set `SITE_ID` or `NEXT_PUBLIC_SITE_ID` to skip the lookup.
3. If you are using the admin API from localhost, make sure the origin is allowed by `middleware.ts`.
4. Restart the dev server after changing env vars.
5. Confirm the Supabase RLS policies for `sites`, `blogs`, and `blog_categories` match the path you are using.

## Row Level Security (RLS)

If you **enable RLS** on `sites` or `blogs`, the **anon** key has **no access** until you add policies. The website uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`, so you must allow the reads your pages need.

### Option A — Policies (typical for public sites)

Run in the Supabase SQL editor (adjust names if you already have policies):

```sql
-- Let anonymous clients resolve site_key → id (required for getSiteIdByKey)
CREATE POLICY "Public can read sites for integration"
ON public.sites
FOR SELECT
TO anon
USING (true);

-- Let anonymous clients read blog posts for listing/detail pages
CREATE POLICY "Public can read blogs"
ON public.blogs
FOR SELECT
TO anon
USING (true);
```

`USING (true)` on `sites` exposes each row’s non-secret columns to anyone with the project URL and anon key—usually acceptable for `id`, `site_key`, name. If you need stricter isolation between tenants, tighten these policies (e.g. only specific columns via a view, or server-only reads with the service role).

### Option B — Skip the `sites` lookup (no `sites` SELECT for anon)

If you do **not** want anon to read `sites`, set the UUID once in the website’s env (copy `id` from the **Sites** row in Supabase or from the admin app):

```env
SITE_ID=00000000-0000-0000-0000-000000000000
# or, if your app reads it on the client:
NEXT_PUBLIC_SITE_ID=00000000-0000-0000-0000-000000000000
```

Your `lib/blogs.ts` can use this and **not** query `sites` at runtime. You still need a **SELECT** policy on `blogs` for anon (unless all blog reads go through a server route using the **service role**).

## Notes

- Do not resolve sites by domain inside app logic anymore.
- Keep `domain` as optional metadata/mapping only.
- For localhost/staging/preview, keep `SITE_KEY` stable per website project.
- After enabling RLS, if you see “Failed to resolve site_id for site_key … add a SELECT policy”, apply Option A or B above.
