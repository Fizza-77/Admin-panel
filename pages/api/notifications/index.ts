import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { resolveAdminUserContextFromApi } from '@/lib/auth/resolveUserContext';
import { reportError } from '@/lib/monitoring';

type NotificationKind = 'task' | 'attendance';

type UnifiedNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  href: string;
};

function parseMarkItems(body: Record<string, unknown>): Array<{ id: string; kind: NotificationKind }> {
  const items = Array.isArray(body.items) ? body.items : [];
  const parsed: Array<{ id: string; kind: NotificationKind }> = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const id = typeof (item as { id?: unknown }).id === 'string' ? (item as { id: string }).id : '';
    const kind = (item as { kind?: unknown }).kind;
    if (!id) {
      continue;
    }
    if (kind === 'task' || kind === 'attendance') {
      parsed.push({ id, kind });
    }
  }

  return parsed;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await resolveAdminUserContextFromApi(req, res);
  if (!ctx) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { userId, permissions } = ctx;

  if (req.method === 'GET') {
    const limit = Math.min(Number.parseInt(String(req.query.limit ?? '30'), 10) || 30, 100);

    const [taskResult, attendanceResult] = await Promise.all([
      permissions.canManageTasks
        ? supabase
            .from('task_notifications')
            .select('id, task_id, title, body, read_at, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('attendance_notifications')
        .select('id, attendance_date, title, body, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    if (taskResult.error) {
      reportError(taskResult.error, { source: 'api/notifications GET task' });
      return res.status(500).json({ message: 'Failed to load notifications' });
    }

    if (attendanceResult.error) {
      reportError(attendanceResult.error, { source: 'api/notifications GET attendance' });
      return res.status(500).json({ message: 'Failed to load notifications' });
    }

    const taskNotifications: UnifiedNotification[] = (taskResult.data ?? []).map((row) => ({
      id: row.id,
      kind: 'task' as const,
      title: row.title,
      body: row.body,
      read_at: row.read_at,
      created_at: row.created_at,
      href: '/tasks',
    }));

    const attendanceNotifications: UnifiedNotification[] = (attendanceResult.data ?? []).map((row) => ({
      id: row.id,
      kind: 'attendance' as const,
      title: row.title,
      body: row.body,
      read_at: row.read_at,
      created_at: row.created_at,
      href: '/attendance',
    }));

    const notifications = [...taskNotifications, ...attendanceNotifications]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    const unreadCount = notifications.filter((n) => !n.read_at).length;

    return res.status(200).json({ notifications, unreadCount });
  }

  if (req.method === 'PATCH') {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const markAll = body.mark_all === true;
    const now = new Date().toISOString();

    if (markAll) {
      const updates = [
        supabase
          .from('attendance_notifications')
          .update({ read_at: now })
          .eq('user_id', userId)
          .is('read_at', null),
      ];

      if (permissions.canManageTasks) {
        updates.push(
          supabase
            .from('task_notifications')
            .update({ read_at: now })
            .eq('user_id', userId)
            .is('read_at', null),
        );
      }

      const results = await Promise.all(updates);
      for (const result of results) {
        if (result.error) {
          reportError(result.error, { source: 'api/notifications PATCH all' });
          return res.status(500).json({ message: 'Failed to mark notifications read' });
        }
      }

      return res.status(200).json({ success: true });
    }

    const items = parseMarkItems(body);
    if (items.length === 0) {
      return res.status(400).json({ message: 'Provide items array or mark_all: true' });
    }

    const taskIds = items.filter((item) => item.kind === 'task').map((item) => item.id);
    const attendanceIds = items.filter((item) => item.kind === 'attendance').map((item) => item.id);

    if (taskIds.length > 0) {
      if (!permissions.canManageTasks) {
        return res.status(403).json({ message: 'You do not have access to task notifications.' });
      }

      const { error } = await supabase
        .from('task_notifications')
        .update({ read_at: now })
        .eq('user_id', userId)
        .in('id', taskIds);

      if (error) {
        reportError(error, { source: 'api/notifications PATCH task ids' });
        return res.status(500).json({ message: 'Failed to mark notifications read' });
      }
    }

    if (attendanceIds.length > 0) {
      const { error } = await supabase
        .from('attendance_notifications')
        .update({ read_at: now })
        .eq('user_id', userId)
        .in('id', attendanceIds);

      if (error) {
        reportError(error, { source: 'api/notifications PATCH attendance ids' });
        return res.status(500).json({ message: 'Failed to mark notifications read' });
      }
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
