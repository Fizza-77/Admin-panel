import type { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_REFRESH_COOKIE, ADMIN_SESSION_COOKIE } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, password } = req.body;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ message: 'Supabase environment variables are missing' });
  }

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const submittedPassword = String(password);

  const allowedEmails = (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.length > 0 && !allowedEmails.includes(normalizedEmail)) {
    return res.status(403).json({ message: 'This email is not allowed to access the admin panel' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: submittedPassword,
  });

  if (error || !data.session?.access_token || !data.session.refresh_token) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  res.setHeader(
    'Set-Cookie',
    [
      serialize(ADMIN_SESSION_COOKIE, data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      }),
      serialize(ADMIN_REFRESH_COOKIE, data.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      }),
    ],
  );

  return res.status(200).json({ success: true });
}