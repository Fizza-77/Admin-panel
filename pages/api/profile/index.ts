import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUserFromApiRequest } from '@/lib/auth';
import {
  fetchAppProfileRow,
  updateEmployeePersonalProfile,
} from '@/lib/permissions/appProfileDb';
import { normalizePersonalInput } from '@/lib/employees/profile';
import { formatDbError } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

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
      surname: row?.surname ?? null,
      qualification: row?.qualification ?? null,
      contact_info: row?.contact_info ?? null,
      avatar_url: row?.avatar_url ?? null,
      email: user.email ?? null,
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {};
    const personal = normalizePersonalInput(body);

    const { row: existing, error: readErr } = await fetchAppProfileRow(user.id);
    if (readErr) {
      reportError(readErr, { source: 'api/profile PATCH read', userId: user.id });
      return res.status(500).json({ message: formatDbError(readErr) });
    }

    const nextPersonal = {
      display_name: typeof body.display_name === 'string' ? personal.display_name : (existing?.display_name ?? null),
      surname: typeof body.surname === 'string' ? personal.surname : (existing?.surname ?? null),
      qualification:
        typeof body.qualification === 'string' ? personal.qualification : (existing?.qualification ?? null),
      contact_info: typeof body.contact_info === 'string' ? personal.contact_info : (existing?.contact_info ?? null),
    };

    const result = await updateEmployeePersonalProfile(user.id, nextPersonal);

    if (!result.ok) {
      reportError(result.error, { source: 'api/profile PATCH update', userId: user.id });
      return res.status(500).json({ message: formatDbError(result.error) });
    }

    return res.status(200).json({
      ...nextPersonal,
      avatar_url: existing?.avatar_url ?? null,
      email: user.email ?? null,
    });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
