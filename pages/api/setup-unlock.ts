import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { verifyAdminSession, ADMIN_SETUP_GATE_COOKIE } from '@/lib/auth';
import { reportError } from '@/lib/monitoring';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const auth = await verifyAdminSession(req, res);
  if (!auth.ok) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const expected = process.env.ADMIN_SETUP_PASSWORD;
  if (!expected || !String(expected).trim()) {
    return res.status(400).json({ message: 'ADMIN_SETUP_PASSWORD is not configured on the server' });
  }

  const { password } = req.body ?? {};
  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  if (password !== expected) {
    return res.status(401).json({ message: 'Invalid setup password' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || !jwtSecret.trim()) {
    reportError(new Error('Missing JWT_SECRET in setup-unlock API'), {
      source: 'api/setup-unlock',
    });
    return res.status(500).json({ message: 'Server configuration error: JWT_SECRET is missing.' });
  }

  const token = jwt.sign({ setup: true }, jwtSecret, {
    expiresIn: '8h',
  });

  res.setHeader(
    'Set-Cookie',
    serialize(ADMIN_SETUP_GATE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8,
      path: '/',
    }),
  );

  return res.status(200).json({ success: true });
}
