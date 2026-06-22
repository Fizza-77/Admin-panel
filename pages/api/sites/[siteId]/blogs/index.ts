import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { buildBlogRow, type BlogBody } from '@/lib/blogs/blogRow';
import { normalizeSiteId } from '@/lib/sites/getSiteById';
import { supabase, supabaseServiceRoleKeyStatus } from '@/lib/supabase/server';
import { apiErrorFromDbError, rlsConfigurationHint } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireApiPermission(req, res, { blogs: true });
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message });
    }

    const siteId = normalizeSiteId(typeof req.query.siteId === 'string' ? req.query.siteId : null);
    if (!siteId) {
      return res.status(400).json({ message: 'Invalid site' });
    }

    if (req.method === 'GET') {
      const slug = req.query.slug;
      if (typeof slug !== 'string' || !slug) {
        return res.status(400).json({ message: 'Missing slug query parameter' });
      }
      const excludeId = typeof req.query.excludeId === 'string' ? req.query.excludeId : undefined;

      let query = supabase.from('blogs').select('id').eq('site_id', siteId).eq('slug', slug);
      if (excludeId) {
        query = query.neq('id', excludeId);
      }
      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Slug check error:', error);
        return res.status(500).json({ message: 'Failed to check slug' });
      }

      return res.status(200).json({ available: !data });
    }

    if (req.method === 'POST') {
      if (!supabaseServiceRoleKeyStatus.valid) {
        return res.status(503).json({
          message:
            `${supabaseServiceRoleKeyStatus.message ?? 'Invalid SUPABASE_SERVICE_ROLE_KEY'}. ` +
            `Admin cannot create blogs when the server uses the anon key. ${rlsConfigurationHint()}`,
        });
      }

      const body = req.body as BlogBody;
      const status = body?.status === 'draft' ? 'draft' : 'published';
      if (!body?.title || !body?.slug || !(body?.date_published || body?.display_date)) {
        return res.status(400).json({ message: 'Missing required fields: title, slug, date_published' });
      }

      let slugQuery = supabase.from('blogs').select('id').eq('site_id', siteId).eq('slug', body.slug);
      const { data: existing } = await slugQuery.maybeSingle();
      if (existing) {
        return res.status(409).json({ message: 'This slug is already in use for this site.' });
      }

      let row;
      try {
        row = buildBlogRow(siteId, { ...body, status });
      } catch (buildError: any) {
        return res.status(400).json({ message: buildError?.message || 'Invalid blog payload' });
      }
      const { error } = await supabase.from('blogs').insert([row]);

      if (error) {
        console.error('Blog insert error:', error);
        const { status, message } = apiErrorFromDbError(error, 'blog create');
        return res.status(status).json({ message });
      }

      return res.status(201).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error) {
    reportError(error, { source: 'api/sites/[siteId]/blogs/index' });
    return res.status(500).json({ message: 'Unexpected server error' });
  }
}
