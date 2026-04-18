import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getAuthUserFromApiRequest } from '@/lib/auth';
import { supabase } from '@/lib/supabase/server';
import { env } from '@/lib/env/server';
import { reportError } from '@/lib/monitoring';

const MIN_LEN = 8;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const user = await getAuthUserFromApiRequest(req, res);
  if (!user?.email) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const body = req.body ?? {};
  const currentPassword = typeof body.current_password === 'string' ? body.current_password : '';
  const newPassword = typeof body.new_password === 'string' ? body.new_password : '';

  if (!currentPassword) {
    return res.status(400).json({ message: 'Current password is required' });
  }
  if (newPassword.length < MIN_LEN) {
    return res.status(400).json({ message: `New password must be at least ${MIN_LEN} characters` });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ message: 'New password must be different from your current password' });
  }

  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: signErr } = await anon.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signErr) {
    return res.status(400).json({ message: 'Current password is incorrect' });
  }

  const { error: upErr } = await supabase.auth.admin.updateUserById(user.id, { password: newPassword });
  if (upErr) {
    reportError(upErr, { source: 'api/profile/password updateUserById' });
    return res.status(500).json({ message: upErr.message || 'Could not update password' });
  }

  return res.status(200).json({ success: true });
}
