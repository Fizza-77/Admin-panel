import type { NextApiRequest, NextApiResponse } from 'next';
import type { GetServerSidePropsContext } from 'next';
import nookies from 'nookies';
import { resolveAdminSession } from '@/lib/auth/resolveSession';
import { getAppProfile } from '@/lib/permissions/getAppProfile';
import type { AppPermissions } from '@/lib/permissions/types';

/** One resolved admin identity + permission flags for a request. */
export type AdminUserContext = {
  userId: string;
  email: string | null;
  permissions: AppPermissions;
  profileLoadError: string | null;
};

function withProfileLoadError(permissions: AppPermissions, loadError: string | null): AppPermissions {
  if (!loadError) {
    return permissions;
  }
  return { ...permissions, profileLoadError: loadError };
}

/**
 * Single entry point: validate session cookies, then load RBAC from the database.
 * Use this instead of calling resolveAdminSession + getAppProfile separately.
 */
export async function resolveAdminUserContext(
  cookies: Partial<Record<string, string>>,
  writeTarget?: NextApiResponse | GetServerSidePropsContext,
): Promise<AdminUserContext | null> {
  const user = await resolveAdminSession(cookies, writeTarget);
  if (!user?.id) {
    return null;
  }

  const { permissions, loadError } = await getAppProfile(user.id, user.email);

  return {
    userId: user.id,
    email: user.email ?? null,
    permissions: withProfileLoadError(permissions, loadError),
    profileLoadError: loadError,
  };
}

export function resolveAdminUserContextFromApi(
  req: NextApiRequest,
  res?: NextApiResponse,
): Promise<AdminUserContext | null> {
  return resolveAdminUserContext(req.cookies, res);
}

export function resolveAdminUserContextFromGssp(
  context: GetServerSidePropsContext,
): Promise<AdminUserContext | null> {
  return resolveAdminUserContext(nookies.get(context), context);
}
