import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { isPrimaryAdminEmail } from '@/lib/permissions/primaryAdmin';
import { reportError } from '@/lib/monitoring';

/** List Auth users for assignee pickers (same pattern as admin users list). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { tasks: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const raw: { id: string; email: string | undefined }[] = [];
  let page = 1;
  const perPage = 100;

  for (;;) {
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (listError) {
      reportError(listError, { source: 'api/tasks/users listUsers' });
      return res.status(500).json({ message: listError.message || 'Failed to list users' });
    }

    const batch = listData?.users ?? [];
    for (const u of batch) {
      raw.push({ id: u.id, email: u.email });
    }

    if (batch.length < perPage) {
      break;
    }
    page += 1;
    if (page > 10) {
      break;
    }
  }

  const ids = raw.map((u) => u.id);
  let nameById = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data: profiles, error: pErr } = await supabase
      .from('app_profiles')
      .select('user_id, display_name')
      .in('user_id', ids);
    if (!pErr && profiles) {
      nameById = new Map(profiles.map((p) => [p.user_id, p.display_name]));
    }
  }

  const includePrimary = isPrimaryAdminEmail(auth.permissions.accountEmail);

  const users = raw
    .filter((u) => includePrimary || !isPrimaryAdminEmail(u.email))
    .map((u) => ({
      id: u.id,
      email: u.email,
      display_name: nameById.get(u.id) ?? null,
    }));

  return res.status(200).json({ users });
}
