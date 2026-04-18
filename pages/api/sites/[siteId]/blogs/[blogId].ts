import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { buildBlogRow, type BlogBody } from '@/lib/blogs/blogRow';
import { supabase } from '@/lib/supabase/server';
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

    const { siteId, blogId } = req.query;

    if (typeof siteId !== 'string' || typeof blogId !== 'string') {
      return res.status(400).json({ message: 'Invalid route parameters' });
    }

    if (req.method === 'PUT') {
      const body = req.body as BlogBody;
      const status = body?.status === 'draft' ? 'draft' : 'published';
      if (!body?.title || !body?.slug || !body?.display_date) {
        return res.status(400).json({ message: 'Missing required fields: title, slug, display_date' });
      }

      const { data: slugConflict } = await supabase
        .from('blogs')
        .select('id')
        .eq('site_id', siteId)
        .eq('slug', body.slug)
        .neq('id', blogId)
        .maybeSingle();

      if (slugConflict) {
        return res.status(409).json({ message: 'This slug is already in use for this site.' });
      }

      let row;
      try {
        row = buildBlogRow(siteId, { ...body, status });
      } catch (buildError: any) {
        return res.status(400).json({ message: buildError?.message || 'Invalid blog payload' });
      }
      const { data, error } = await supabase
        .from('blogs')
        .update(row)
        .eq('id', blogId)
        .eq('site_id', siteId)
        .select('id');

      if (error) {
        console.error('Blog update error:', error);
        return res.status(500).json({ message: error.message || 'Failed to update blog' });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({ message: 'Blog not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Blog updated successfully',
      });
    }

    if (req.method === 'DELETE') {
      const { data, error } = await supabase
        .from('blogs')
        .delete()
        .eq('id', blogId)
        .eq('site_id', siteId)
        .select('id');

      if (error) {
        console.error('Error deleting blog:', error);
        return res.status(500).json({ message: 'Failed to delete blog' });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({ message: 'Blog not found' });
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
