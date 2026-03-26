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
    .order('display_date', { ascending: false });

  if (error) throw error;
  return blogs ?? [];
}
```

## 4) Recommended server-side API pattern (Next.js)

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

## Notes

- Do not resolve sites by domain inside app logic anymore.
- Keep `domain` as optional metadata/mapping only.
- For localhost/staging/preview, keep `SITE_KEY` stable per website project.
