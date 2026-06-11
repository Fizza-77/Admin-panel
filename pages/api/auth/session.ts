import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveAdminUserContextFromApi } from '@/lib/auth/resolveUserContext';

/**
 * Keeps the admin session alive and returns user id + permissions (UI cache).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const ctx = await resolveAdminUserContextFromApi(req, res);
  if (!ctx) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  return res.status(200).json({
    ok: true,
    userId: ctx.userId,
    email: ctx.email,
    permissions: ctx.permissions,
  });
}
