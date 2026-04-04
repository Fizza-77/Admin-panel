import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // ✅ CORS HEADERS (MUST BE FIRST)
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173'); // change in production
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ HANDLE PREFLIGHT
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ❌ Reject non-POST AFTER handling OPTIONS
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, password } = req.body;

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  if (email === adminEmail && password === adminPassword) {
    const token = jwt.sign(
      { email, role: 'admin' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    // ✅ FIXED COOKIE
    res.setHeader('Set-Cookie', serialize('admin_session', token, {
      httpOnly: true,
      secure: true,                // 🔥 REQUIRED for SameSite=None
      sameSite: 'none',            // 🔥 REQUIRED for cross-origin
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    }));

    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ message: 'Invalid credentials' });
}