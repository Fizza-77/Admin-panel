import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminSession } from '@/lib/auth';
import { buildBlogRow, type BlogBody } from '@/lib/blogs/blogRow';
import { supabase } from '@/lib/supabase/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await verifyAdminSession(req, res);
  if (!auth.ok) {
    return res.status(401).json({ message: auth.message });
  }

  const siteId = req.query.siteId;
  if (typeof siteId !== 'string') {
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
    const body = req.body as BlogBody;
    if (!body?.title || !body?.slug || !body?.display_date) {
      return res.status(400).json({ message: 'Missing required fields: title, slug, display_date' });
    }

    let slugQuery = supabase.from('blogs').select('id').eq('site_id', siteId).eq('slug', body.slug);
    const { data: existing } = await slugQuery.maybeSingle();
    if (existing) {
      return res.status(409).json({ message: 'This slug is already in use for this site.' });
    }

    const row = buildBlogRow(siteId, body);
    const { error } = await supabase.from('blogs').insert([row]);

    if (error) {
      console.error('Blog insert error:', error);
      return res.status(500).json({ message: error.message || 'Failed to create blog' });
    }

    return res.status(201).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
