import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUserFromApiRequest } from '@/lib/auth';
import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';

const MAX_NAME = 120;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthUserFromApiRequest(req, res);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('app_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      reportError(error, { source: 'api/profile GET' });
      return res.status(500).json({ message: 'Failed to load profile' });
    }

    return res.status(200).json({
      display_name: data?.display_name ?? null,
      email: user.email ?? null,
    });
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {};
    const raw = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    const display_name = raw.length > 0 ? raw.slice(0, MAX_NAME) : null;

    const { data: existing } = await supabase.from('app_profiles').select('user_id').eq('user_id', user.id).maybeSingle();

    if (existing) {
      const { error: upErr } = await supabase
        .from('app_profiles')
        .update({ display_name, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (upErr) {
        reportError(upErr, { source: 'api/profile PATCH update' });
        return res.status(500).json({ message: upErr.message || 'Failed to save name' });
      }
    } else {
      const { error: insErr } = await supabase.from('app_profiles').insert({
        user_id: user.id,
        can_manage_blogs: false,
        can_manage_tasks: false,
        can_manage_users: false,
        display_name,
        updated_at: new Date().toISOString(),
      });
      if (insErr) {
        reportError(insErr, { source: 'api/profile PATCH insert' });
        return res.status(500).json({ message: insErr.message || 'Failed to save name' });
      }
    }

    return res.status(200).json({ display_name, email: user.email ?? null });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
