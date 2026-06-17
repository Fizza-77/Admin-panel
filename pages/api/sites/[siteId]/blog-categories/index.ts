import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { supabase } from '@/lib/supabase/server';
import { countBlogsForSiteId, lookupSiteById, normalizeSiteId } from '@/lib/sites/getSiteById';

const SLUG_REGEX = /^[a-z0-9-]+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { blogs: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const siteId = normalizeSiteId(typeof req.query.siteId === 'string' ? req.query.siteId : null);
  if (!siteId) {
    return res.status(400).json({ message: 'Invalid site' });
  }

  const siteLookup = await lookupSiteById(siteId);
  if (!siteLookup.ok) {
    if (siteLookup.reason === 'query_error') {
      return res.status(500).json({ message: siteLookup.message });
    }
    if (siteLookup.reason === 'invalid_id') {
      return res.status(400).json({ message: siteLookup.message });
    }

    const blogCount = await countBlogsForSiteId(siteId);
    if (blogCount > 0) {
      return res.status(404).json({
        message:
          'This site record is missing from the database, but blog posts still reference it. Re-connect the site from the dashboard to fix this.',
        orphaned: true,
        blogCount,
        siteId,
      });
    }
    return res.status(404).json({ message: 'Site not found', siteId });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('blog_categories')
      .select('id,site_id,slug,name,description,sort_order,created_at')
      .eq('site_id', siteId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to load categories' });
    }

    return res.status(200).json({ categories: data ?? [] });
  }

  if (req.method === 'POST') {
    const { slug, name, description, sort_order } = req.body ?? {};
    if (typeof slug !== 'string' || !slug.trim()) {
      return res.status(400).json({ message: 'slug is required' });
    }
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }

    const normalizedSlug = slug.trim().toLowerCase();
    if (!SLUG_REGEX.test(normalizedSlug)) {
      return res.status(400).json({ message: 'slug may only use lowercase letters, numbers, and hyphens' });
    }

    const order = typeof sort_order === 'number' ? sort_order : Number(sort_order) || 0;

    const { data, error } = await supabase
      .from('blog_categories')
      .insert([
        {
          site_id: siteId,
          slug: normalizedSlug,
          name: name.trim(),
          description: typeof description === 'string' ? description.trim() || null : null,
          sort_order: order,
        },
      ])
      .select('id,site_id,slug,name,description,sort_order')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'A category with this slug already exists for this site.' });
      }
      console.error(error);
      return res.status(500).json({ message: error.message || 'Failed to create category' });
    }

    return res.status(201).json({ category: data });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
