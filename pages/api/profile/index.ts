import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUserFromApiRequest } from '@/lib/auth';
import {
  DEFAULT_APP_PROFILE_FLAGS,
  fetchAppProfileRow,
  upsertAppProfileRow,
} from '@/lib/permissions/appProfileDb';
import { formatDbError } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

const MAX_NAME = 120;

function normalizeAvatarUrl(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUserFromApiRequest(req, res);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const { row, error } = await fetchAppProfileRow(user.id);

    if (error) {
      reportError(error, { source: 'api/profile GET' });
      return res.status(500).json({ message: formatDbError(error) });
    }

    return res.status(200).json({
      display_name: row?.display_name ?? null,
      avatar_url: row?.avatar_url ?? null,
      email: user.email ?? null,
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {};
    const raw = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    const display_name = raw.length > 0 ? raw.slice(0, MAX_NAME) : null;
    const avatarPatch = normalizeAvatarUrl(body.avatar_url);

    const { row: existing, error: readErr } = await fetchAppProfileRow(user.id);
    if (readErr) {
      reportError(readErr, { source: 'api/profile PATCH read', userId: user.id });
      return res.status(500).json({ message: formatDbError(readErr) });
    }

    const flags = existing ?? DEFAULT_APP_PROFILE_FLAGS;
    const result = await upsertAppProfileRow({
      user_id: user.id,
      can_manage_blogs: flags.can_manage_blogs,
      can_manage_tasks: flags.can_manage_tasks,
      can_administer_tasks: flags.can_administer_tasks,
      can_manage_users: flags.can_manage_users,
      can_manage_attendance: flags.can_manage_attendance,
      display_name: typeof body.display_name === 'string' ? display_name : (existing?.display_name ?? null),
      avatar_url: avatarPatch !== undefined ? avatarPatch : (existing?.avatar_url ?? null),
    });

    if (!result.ok) {
      reportError(result.error, { source: 'api/profile PATCH upsert', userId: user.id });
      return res.status(500).json({ message: formatDbError(result.error) });
    }

    const nextDisplayName =
      typeof body.display_name === 'string' ? display_name : (existing?.display_name ?? null);
    const nextAvatarUrl = avatarPatch !== undefined ? avatarPatch : (existing?.avatar_url ?? null);

    return res.status(200).json({
      display_name: nextDisplayName,
      avatar_url: nextAvatarUrl,
      email: user.email ?? null,
    });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
