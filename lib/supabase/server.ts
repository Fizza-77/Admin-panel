import { createClient } from '@supabase/supabase-js';
import { env } from '../env/server';
import { inspectServiceRoleKey } from './validateServiceRoleKey';

const keyStatus = inspectServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

if (!keyStatus.valid) {
  const msg = `[Supabase] ${keyStatus.message}`;
  console.error(msg);
  // Do not throw — a crash causes nginx 502. /api/health reports the misconfiguration.
}

export const supabaseServiceRoleKeyStatus = keyStatus;

if (process.env.NODE_ENV === 'production') {
  console.info(
    `[Supabase] service_role key valid=${keyStatus.valid} role=${keyStatus.role ?? 'unknown'} matches_anon=${keyStatus.matchesAnonKey}`,
  );
}

export const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  },
  db: {
    schema: 'public',
  },
});
