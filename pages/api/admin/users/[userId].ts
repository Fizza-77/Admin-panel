import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { isPrimaryAdminEmail } from '@/lib/permissions/primaryAdmin';
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

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const body = req.body ?? {};
  if (
    typeof body.can_manage_blogs !== 'boolean' ||
    typeof body.can_manage_tasks !== 'boolean' ||
    typeof body.can_manage_users !== 'boolean'
  ) {
    return res.status(400).json({
      message: 'Body must include boolean can_manage_blogs, can_manage_tasks, and can_manage_users',
    });
  }

  const { data: authTarget, error: authTargetErr } = await supabase.auth.admin.getUserById(userId);
  if (authTargetErr || !authTarget?.user) {
    reportError(authTargetErr ?? new Error('Missing user'), { source: 'api/admin/users PATCH getUserById', userId });
    return res.status(404).json({ message: 'User not found' });
  }

  const targetIsPrimary = isPrimaryAdminEmail(authTarget.user.email);

  const { data: existing, error: readErr } = await supabase
    .from('app_profiles')
    .select('display_name, can_manage_blogs, can_manage_tasks, can_manage_users')
    .eq('user_id', userId)
    .maybeSingle();

  if (readErr) {
    reportError(readErr, { source: 'api/admin/users PATCH read' });
    return res.status(500).json({ message: 'Failed to read profile' });
  }

  let display_name: string | null = existing?.display_name ?? null;
  if (typeof body.display_name === 'string') {
    display_name = body.display_name.trim().slice(0, 120) || null;
  }

  let can_manage_blogs = body.can_manage_blogs;
  let can_manage_tasks = body.can_manage_tasks;
  let can_manage_users = body.can_manage_users;

  if (targetIsPrimary) {
    can_manage_blogs = existing?.can_manage_blogs ?? true;
    can_manage_tasks = existing?.can_manage_tasks ?? true;
    can_manage_users = existing?.can_manage_users ?? true;
  } else {
    if (body.can_manage_users) {
      return res.status(400).json({ message: 'Granting user management is not allowed for non-admin accounts.' });
    }
    can_manage_users = false;
  }

  const { error: upsertError } = await supabase.from('app_profiles').upsert(
    {
      user_id: userId,
      can_manage_blogs,
      can_manage_tasks,
      can_manage_users,
      display_name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (upsertError) {
    reportError(upsertError, { source: 'api/admin/users PATCH upsert', userId });
    return res.status(500).json({ message: upsertError.message || 'Failed to save access' });
  }

  return res.status(200).json({
    user: {
      id: userId,
      can_manage_blogs,
      can_manage_tasks,
      can_manage_users,
      display_name,
    },
  });
}
