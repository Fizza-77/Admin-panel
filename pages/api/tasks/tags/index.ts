import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { isPrimaryAdminEnforced } from '@/lib/permissions/primaryAdmin';
import { isTagColorKey } from '@/lib/tasks/tagColors';
import { reportError } from '@/lib/monitoring';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { tasks: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const { userId } = auth;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('tags').select('id,name,color,created_at').order('name', { ascending: true });
    if (error) {
      reportError(error, { source: 'api/tasks/tags GET' });
      return res.status(500).json({ message: 'Failed to load tags' });
    }
    return res.status(200).json({ tags: data ?? [] });
  }

  if (req.method === 'POST') {
    if (!auth.permissions.canCreateTaskTags) {
      return res.status(403).json({
        message: isPrimaryAdminEnforced()
          ? 'Only the primary admin can create tags.'
          : 'You do not have permission to create tags.',
      });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      return res.status(400).json({ message: 'Tag name is required' });
    }

    const colorRaw = req.body?.color;
    if (!isTagColorKey(colorRaw)) {
      return res.status(400).json({ message: 'A valid tag color is required' });
    }

    const { data, error } = await supabase
      .from('tags')
      .insert({ name, color: colorRaw, created_by: userId })
      .select('id,name,color,created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'A tag with this name already exists' });
      }
      reportError(error, { source: 'api/tasks/tags POST' });
      return res.status(500).json({ message: error.message || 'Failed to create tag' });
    }

    return res.status(201).json({ tag: data });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
