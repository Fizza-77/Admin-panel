import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUserFromApiRequest } from '@/lib/auth';
import { getAppProfile } from '@/lib/permissions/getAppProfile';
import { fetchAppProfileRow } from '@/lib/permissions/appProfileDb';
import { checkAppProfileSchema, APP_PROFILE_PERMISSION_COLUMNS } from '@/lib/db/schemaCheck';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { formatDbError } from '@/lib/db/errors';
import { supabase } from '@/lib/supabase/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const auth = await requireApiPermission(req, res, { users: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const sessionUser = await getAuthUserFromApiRequest(req, res);
  if (!sessionUser) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const [profileResult, rawProfile, schema, authUsersWithoutProfiles] = await Promise.all([
    getAppProfile(sessionUser.id, sessionUser.email),
    fetchAppProfileRow(sessionUser.id),
    checkAppProfileSchema(),
    countAuthUsersMissingProfiles(),
  ]);

  return res.status(200).json({
    current_user: {
      id: sessionUser.id,
      email: sessionUser.email ?? null,
    },
    permissions: profileResult.permissions,
    profile_load_error: profileResult.loadError,
    raw_profile: rawProfile.row,
    raw_profile_query_error: rawProfile.error ? formatDbError(rawProfile.error) : null,
    schema: {
      expected_columns: APP_PROFILE_PERMISSION_COLUMNS,
      table_readable: schema.tableReadable,
      missing_columns: schema.missingColumns,
      query_error: schema.queryError,
    },
    auth_users_without_profiles: authUsersWithoutProfiles,
    environment: {
      primary_admin_enforced: Boolean(process.env.ADMIN_OWNER_EMAIL?.trim()),
      bootstrap_owner_emails_configured: Boolean(
        process.env.ADMIN_APP_OWNER_EMAILS?.trim() || process.env.ADMIN_OWNER_EMAIL?.trim(),
      ),
    },
  });
}

async function countAuthUsersMissingProfiles(): Promise<{
  count: number | null;
  error: string | null;
}> {
  const { data: profiles, error: profileError } = await supabase.from('app_profiles').select('user_id');
  if (profileError) {
    return { count: null, error: formatDbError(profileError) };
  }

  const profileIds = new Set((profiles ?? []).map((p) => p.user_id));
  let missing = 0;
  let page = 1;
  const perPage = 100;

  for (;;) {
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage });
    if (listError) {
      return { count: null, error: formatDbError(listError) };
    }

    const batch = listData?.users ?? [];
    for (const user of batch) {
      if (!profileIds.has(user.id)) {
        missing += 1;
      }
    }

    if (batch.length < perPage) {
      break;
    }
    page += 1;
    if (page > 100) {
      break;
    }
  }

  return { count: missing, error: null };
}
