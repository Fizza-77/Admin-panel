import type { NextApiRequest, NextApiResponse } from 'next';
import { assertSetupGateAllowed, verifyAdminSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase/server';

const SLUG_REGEX = /^[a-z0-9-]+$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = verifyAdminSession(req);
  if (!auth.ok) {
    return res.status(401).json({ message: auth.message });
  }
  if (!assertSetupGateAllowed(req, res)) {
    return;
  }

  const siteId = req.query.siteId;
  const categoryId = req.query.categoryId;
  if (typeof siteId !== 'string' || typeof categoryId !== 'string') {
    return res.status(400).json({ message: 'Invalid parameters' });
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {};
    const updates: Record<string, unknown> = {};

    if (typeof body.slug === 'string' && body.slug.trim()) {
      const normalizedSlug = body.slug.trim().toLowerCase();
      if (!SLUG_REGEX.test(normalizedSlug)) {
        return res.status(400).json({ message: 'slug may only use lowercase letters, numbers, and hyphens' });
      }
      updates.slug = normalizedSlug;
    }
    if (typeof body.name === 'string') {
      updates.name = body.name.trim();
    }
    if (body.description !== undefined) {
      updates.description = typeof body.description === 'string' ? body.description.trim() || null : null;
    }
    if (body.sort_order !== undefined) {
      updates.sort_order = typeof body.sort_order === 'number' ? body.sort_order : Number(body.sort_order) || 0;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const { data, error } = await supabase
      .from('blog_categories')
      .update(updates)
      .eq('id', categoryId)
      .eq('site_id', siteId)
      .select('id,site_id,slug,name,description,sort_order')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'A category with this slug already exists for this site.' });
      }
      console.error(error);
      return res.status(500).json({ message: error.message || 'Failed to update category' });
    }

    if (!data) {
      return res.status(404).json({ message: 'Category not found' });
    }

    return res.status(200).json({ category: data });
  }

  if (req.method === 'DELETE') {
    const { data, error } = await supabase
      .from('blog_categories')
      .delete()
      .eq('id', categoryId)
      .eq('site_id', siteId)
      .select('id');

    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Failed to delete category' });
    }

    if (!data?.length) {
      return res.status(404).json({ message: 'Category not found' });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['PATCH', 'DELETE']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
