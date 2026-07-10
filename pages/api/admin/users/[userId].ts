import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { fetchAppProfileRow, upsertAppProfileRow } from '@/lib/permissions/appProfileDb';
import { isPrimaryAdminEmail } from '@/lib/permissions/primaryAdmin';
import { formatDbError } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { users: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const userId = req.query.userId;
  if (typeof userId !== 'string') {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', ['PATCH', 'DELETE']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (req.method === 'DELETE') {
    if (!auth.permissions.isPrimaryAdmin) {
      return res.status(403).json({ message: 'Only ADMIN_OWNER_EMAIL can delete users.' });
    }

    const actingUserId = auth.userId;
    if (userId === actingUserId) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    const { data: targetUserData, error: targetUserErr } = await supabase.auth.admin.getUserById(userId);
    if (targetUserErr || !targetUserData?.user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (isPrimaryAdminEmail(targetUserData.user.email)) {
      return res.status(400).json({ message: 'Primary admin account cannot be deleted.' });
    }

    const { error: deleteProfileError } = await supabase.from('app_profiles').delete().eq('user_id', userId);
    if (deleteProfileError) {
      reportError(deleteProfileError, { source: 'api/admin/users DELETE profile', userId });
      return res.status(500).json({ message: 'Failed to delete user profile.' });
    }

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      reportError(deleteAuthError, { source: 'api/admin/users DELETE auth', userId });
      return res.status(500).json({ message: deleteAuthError.message || 'Failed to delete user.' });
    }

    return res.status(200).json({ success: true });
  }

  const body = req.body ?? {};
  if (
    typeof body.can_manage_blogs !== 'boolean' ||
    typeof body.can_administer_tasks !== 'boolean' ||
    typeof body.can_manage_users !== 'boolean' ||
    typeof body.can_manage_attendance !== 'boolean' ||
    typeof body.can_manage_expenses !== 'boolean'
  ) {
    return res.status(400).json({
      message:
        'Body must include boolean can_manage_blogs, can_administer_tasks, can_manage_users, can_manage_attendance, and can_manage_expenses',
    });
  }

  const { data: authTarget, error: authTargetErr } = await supabase.auth.admin.getUserById(userId);
  if (authTargetErr || !authTarget?.user) {
    reportError(authTargetErr ?? new Error('Missing user'), { source: 'api/admin/users PATCH getUserById', userId });
    return res.status(404).json({ message: 'User not found' });
  }

  const targetIsPrimary = isPrimaryAdminEmail(authTarget.user.email);

  const { row: existing, error: readErr } = await fetchAppProfileRow(userId);

  if (readErr) {
    return res.status(500).json({ message: 'Failed to read profile' });
  }

  let display_name: string | null = existing?.display_name ?? null;
  if (typeof body.display_name === 'string') {
    display_name = body.display_name.trim().slice(0, 120) || null;
  }

  let can_manage_blogs = body.can_manage_blogs;
  const can_manage_tasks = true;
  let can_administer_tasks = body.can_administer_tasks;
  let can_manage_users = body.can_manage_users;
  let can_manage_attendance = body.can_manage_attendance;
  let can_manage_expenses = body.can_manage_expenses;

  if (targetIsPrimary) {
    can_manage_blogs = true;
    can_administer_tasks = true;
    can_manage_users = true;
    can_manage_attendance = true;
    can_manage_expenses = true;
  } else {
    if (body.can_manage_users) {
      return res.status(400).json({ message: 'Granting user management is not allowed for non-admin accounts.' });
    }
    can_manage_users = false;
  }

  const profileResult = await upsertAppProfileRow({
    user_id: userId,
    can_manage_blogs,
    can_manage_tasks,
    can_administer_tasks,
    can_manage_users,
    can_manage_attendance,
    can_manage_expenses,
    display_name,
    avatar_url: existing?.avatar_url ?? null,
  });

  if (!profileResult.ok) {
    reportError(profileResult.error, { source: 'api/admin/users PATCH upsert', userId });
    return res.status(500).json({ message: formatDbError(profileResult.error) || 'Failed to save access' });
  }

  return res.status(200).json({
    user: {
      id: userId,
      can_manage_blogs,
      can_manage_tasks,
      can_administer_tasks,
      can_manage_users,
      can_manage_attendance,
      can_manage_expenses,
      display_name,
    },
  });
}
