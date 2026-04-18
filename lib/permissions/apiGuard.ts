import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthUserFromApiRequest } from '@/lib/auth';
import { getAppProfile } from './getAppProfile';
import type { AppPermissions } from './types';

export type ApiPermissionResult =
  | { ok: true; userId: string; permissions: AppPermissions }
  | { ok: false; status: number; message: string };

/**
 * After a valid session, checks feature flags for API routes.
 */
export async function requireApiPermission(
  req: NextApiRequest,
  res: NextApiResponse | undefined,
  needs: { blogs?: boolean; tasks?: boolean; users?: boolean },
): Promise<ApiPermissionResult> {
  const user = await getAuthUserFromApiRequest(req, res);
  if (!user) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const permissions = await getAppProfile(user.id, user.email);

  if (needs.blogs && !permissions.canManageBlogs) {
    return { ok: false, status: 403, message: 'You do not have access to blog management.' };
  }
  if (needs.tasks && !permissions.canManageTasks) {
    return { ok: false, status: 403, message: 'You do not have access to tasks.' };
  }
  if (needs.users && !permissions.canAccessUserManagement) {
    return { ok: false, status: 403, message: 'You do not have access to user management.' };
  }

  return { ok: true, userId: user.id, permissions };
}
