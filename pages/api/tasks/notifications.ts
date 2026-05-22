import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { reportError } from '@/lib/monitoring';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { tasks: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const { userId } = auth;

  if (req.method === 'GET') {
    const limit = Math.min(Number.parseInt(String(req.query.limit ?? '30'), 10) || 30, 100);
    const { data, error } = await supabase
      .from('task_notifications')
      .select('id, task_id, title, body, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      reportError(error, { source: 'api/tasks/notifications GET' });
      return res.status(500).json({ message: 'Failed to load notifications' });
    }

    const unread = (data ?? []).filter((n) => !n.read_at).length;

    return res.status(200).json({ notifications: data ?? [], unreadCount: unread });
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {};
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((x: unknown) => typeof x === 'string')
      : [];
    const markAll = body.mark_all === true;

    const now = new Date().toISOString();

    if (markAll) {
      const { error } = await supabase
        .from('task_notifications')
        .update({ read_at: now })
        .eq('user_id', userId)
        .is('read_at', null);
      if (error) {
        reportError(error, { source: 'api/tasks/notifications PATCH all' });
        return res.status(500).json({ message: 'Failed to mark notifications read' });
      }
      return res.status(200).json({ success: true });
    }

    if (ids.length === 0) {
      return res.status(400).json({ message: 'Provide ids array or mark_all: true' });
    }

    const { error } = await supabase
      .from('task_notifications')
      .update({ read_at: now })
      .eq('user_id', userId)
      .in('id', ids);

    if (error) {
      reportError(error, { source: 'api/tasks/notifications PATCH ids' });
      return res.status(500).json({ message: 'Failed to mark notifications read' });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
