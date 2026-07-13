import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { fetchAppProfileRow, updateEmployeeAdminProfile } from '@/lib/permissions/appProfileDb';
import { mapEmployeeProfile, normalizeAdminInput } from '@/lib/employees/profile';
import { formatDbError } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { attendance: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const userId = req.query.userId;
  if (typeof userId !== 'string') {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) {
    reportError(authErr ?? new Error('User not found'), { source: 'api/employees GET user', userId });
    return res.status(404).json({ message: 'Employee not found' });
  }

  if (req.method === 'GET') {
    const { row, error } = await fetchAppProfileRow(userId);
    if (error) {
      reportError(error, { source: 'api/employees GET profile', userId });
      return res.status(500).json({ message: formatDbError(error) });
    }

    return res.status(200).json({
      employee: mapEmployeeProfile(userId, authUser.user.email, row),
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {};
    const parsed = normalizeAdminInput(body);
    if ('error' in parsed) {
      return res.status(400).json({ message: parsed.error });
    }

    const { row: existing, error: readErr } = await fetchAppProfileRow(userId);
    if (readErr) {
      reportError(readErr, { source: 'api/employees PATCH read', userId });
      return res.status(500).json({ message: 'Failed to read profile' });
    }

    const nextAdmin = {
      company_role:
        body.company_role !== undefined ? parsed.company_role : (existing?.company_role ?? null),
      salary: body.salary !== undefined ? parsed.salary : (existing?.salary ?? null),
    };

    const result = await updateEmployeeAdminProfile(userId, nextAdmin);
    if (!result.ok) {
      reportError(result.error, { source: 'api/employees PATCH update', userId });
      return res.status(500).json({ message: formatDbError(result.error) });
    }

    const { row: updated } = await fetchAppProfileRow(userId);
    return res.status(200).json({
      employee: mapEmployeeProfile(userId, authUser.user.email, updated),
    });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
