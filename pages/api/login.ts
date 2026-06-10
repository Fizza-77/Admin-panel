import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { supabase as supabaseAdmin } from '@/lib/supabase/server';
import { setSessionCookiesOnResponse } from '@/lib/auth/sessionCookies';
import { ensureAppProfileRow, isBootstrapOwnerEmail } from '@/lib/permissions/getAppProfile';
import { reportError } from '@/lib/monitoring';

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

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: submittedPassword,
  });

  if (error || !data.session?.access_token || !data.session.refresh_token || !data.user?.id) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (allowedEmails.length > 0 && !allowedEmails.includes(normalizedEmail)) {
    if (!isBootstrapOwnerEmail(normalizedEmail)) {
      const { count, error: profileError } = await supabaseAdmin
        .from('app_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', data.user.id);

      if (profileError) {
        reportError(profileError, { source: 'login.app_profiles', userId: data.user.id });
        await supabaseAdmin.auth.admin.signOut(data.session.access_token);
        return res.status(500).json({ message: 'Could not verify access' });
      }

      if (!count) {
        await supabaseAdmin.auth.admin.signOut(data.session.access_token);
        return res.status(403).json({ message: 'This email is not allowed to access the admin panel' });
      }
    }
  }

  const profileEnsure = await ensureAppProfileRow(data.user.id);
  if (!profileEnsure.ok) {
    reportError(new Error(profileEnsure.error ?? 'Profile bootstrap failed'), {
      source: 'login.ensureAppProfileRow',
      userId: data.user.id,
      email: normalizedEmail,
    });
    // Allow sign-in — profile issues surface on the next page via getAppProfile /profile-error.
    // Blocking login here locked out users when migrations were partially applied.
  }

  setSessionCookiesOnResponse(res, data.session.access_token, data.session.refresh_token);

  return res.status(200).json({ success: true });
}