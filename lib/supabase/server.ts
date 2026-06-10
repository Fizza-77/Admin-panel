import { createClient } from '@supabase/supabase-js';
import { env } from '../env/server';
import { assertValidServiceRoleKey, inspectServiceRoleKey } from './validateServiceRoleKey';

const keyStatus = inspectServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

if (!keyStatus.valid) {
  const msg = `[Supabase] ${keyStatus.message}`;
  console.error(msg);
  if (process.env.NODE_ENV === 'production') {
    assertValidServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }
}

export const supabaseServiceRoleKeyStatus = keyStatus;

export const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
});
