import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUserFromApiRequest } from '@/lib/auth';

/**
 * Keeps the admin session alive: validates access token or refreshes using the refresh cookie,
 * then re-issues HttpOnly cookies (sliding expiration).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const user = await getAuthUserFromApiRequest(req, res);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  return res.status(200).json({
    ok: true,
    email: user.email ?? null,
  });
}
