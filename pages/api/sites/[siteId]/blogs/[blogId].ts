import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { buildBlogRow, type BlogBody } from '@/lib/blogs/blogRow';
import { updateBlog, deleteBlog, formatBlogWriteError, blogWriteHttpStatus } from '@/lib/blogs/blogWrites';
import { normalizeSiteId } from '@/lib/sites/getSiteById';
import { supabase, supabaseServiceRoleKeyStatus } from '@/lib/supabase/server';
import { apiErrorFromDbError, rlsConfigurationHint } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

type SuccessResponse = {
  success: true;
  message: string;
};

type ErrorResponse = {
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  try {
    const auth = await requireApiPermission(req, res, { blogs: true });
    if (!auth.ok) {
      return res.status(auth.status).json({ message: auth.message });
    }

    const siteId = normalizeSiteId(typeof req.query.siteId === 'string' ? req.query.siteId : null);
    const blogId = normalizeSiteId(typeof req.query.blogId === 'string' ? req.query.blogId : null);

    if (!siteId || !blogId) {
      return res.status(400).json({ message: 'Invalid route parameters' });
    }

    if (req.method === 'PUT') {
      if (!supabaseServiceRoleKeyStatus.valid) {
        return res.status(503).json({
          message:
            `${supabaseServiceRoleKeyStatus.message ?? 'Invalid SUPABASE_SERVICE_ROLE_KEY'}. ` +
            `Admin cannot update blogs when the server uses the anon key. ${rlsConfigurationHint()}`,
        });
      }

      const body = req.body as BlogBody;
      const status = body?.status === 'draft' ? 'draft' : 'published';
      if (!body?.title || !body?.slug || !(body?.date_published || body?.display_date)) {
        return res.status(400).json({ message: 'Missing required fields: title, slug, date_published' });
      }

      const { data, error } = await supabase
        .from('blogs')
        .select('id')
        .eq('site_id', siteId)
        .eq('slug', body.slug)
        .neq('id', blogId)
        .maybeSingle();

      if (error) {
        console.error('Slug check error:', error);
        return res.status(500).json({ message: 'Failed to check slug' });
      }

      if (data) {
        return res.status(409).json({ message: 'This slug is already in use for this site.' });
      }

      let row;
      try {
        row = buildBlogRow(siteId, { ...body, status });
      } catch (buildError: any) {
        return res.status(400).json({ message: buildError?.message || 'Invalid blog payload' });
      }

      const writeResult = await updateBlog(blogId, siteId, row);
      if (!writeResult.ok) {
        const message = formatBlogWriteError(writeResult.error);
        const httpStatus = blogWriteHttpStatus(writeResult.error);
        if (httpStatus === 500) {
          const mapped = apiErrorFromDbError(writeResult.error, 'blog update');
          return res.status(mapped.status).json({ message: message || mapped.message });
        }
        return res.status(httpStatus).json({ message });
      }

      return res.status(200).json({
        success: true,
        message: 'Blog updated successfully',
      });
    }

    if (req.method === 'DELETE') {
      const writeResult = await deleteBlog(blogId, siteId);
      if (!writeResult.ok) {
        const message = formatBlogWriteError(writeResult.error);
        return res.status(blogWriteHttpStatus(writeResult.error)).json({ message });
      }

      return res.status(200).json({
        success: true,
        message: 'Blog deleted successfully',
      });
    }

    res.setHeader('Allow', ['PUT', 'DELETE']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  } catch (error) {
    reportError(error, { source: 'api/sites/[siteId]/blogs/[blogId]' });
    return res.status(500).json({ message: 'Unexpected server error' });
  }
}
