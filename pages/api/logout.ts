import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { ADMIN_SETUP_GATE_COOKIE } from '@/lib/auth/cookieNames';
import { clearSessionCookieHeaders } from '@/lib/auth/sessionCookies';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const clear = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  };

  res.setHeader('Set-Cookie', [
    ...clearSessionCookieHeaders(),
    serialize(ADMIN_SETUP_GATE_COOKIE, '', clear),
  ]);

  return res.status(200).json({ success: true });
}
