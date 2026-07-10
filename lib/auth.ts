import type { NextApiRequest, NextApiResponse } from 'next';
import { GetServerSidePropsContext } from 'next';
import nookies from 'nookies';
import jwt from 'jsonwebtoken';
import { resolveAdminSession } from '@/lib/auth/resolveSession';
import { clearSessionCookieHeaders } from '@/lib/auth/sessionCookies';
import { reportError } from '@/lib/monitoring';
import { resolveAdminUserContextFromGssp } from '@/lib/auth/resolveUserContext';
import type { AppPermissions } from '@/lib/permissions/types';
import { redirectWhenBlogDenied, redirectWhenTaskDenied } from '@/lib/permissions/redirects';

import {
  ADMIN_SETUP_GATE_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_REFRESH_COOKIE,
} from '@/lib/auth/cookieNames';

export { ADMIN_SETUP_GATE_COOKIE, ADMIN_SESSION_COOKIE, ADMIN_REFRESH_COOKIE };

function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    return null;
  }
  return secret;
}

function safeReturnPath(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '/';
  const path = raw.split('?')[0] ?? '/';
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('..')) {
    return '/';
  }
  return path;
}

/**
 * For `/setup-unlock` only: skip the form if `ADMIN_SETUP_PASSWORD` is unset, or if the gate cookie is already valid.
 */
export function resolveSetupUnlockGate(
  context: GetServerSidePropsContext,
):
  | { redirect: { destination: string; permanent: boolean } }
  | { props: { returnUrl: string } } {
  const q = context.query.returnUrl;
  const raw = typeof q === 'string' ? q : undefined;
  const safe = safeReturnPath(raw);

  const expected = process.env.ADMIN_SETUP_PASSWORD;
  if (!expected || !String(expected).trim()) {
    return { redirect: { destination: safe, permanent: false } };
  }

  const cookies = nookies.get(context);
  const token = cookies[ADMIN_SETUP_GATE_COOKIE];
  if (token) {
    try {
      const secret = getJwtSecret();
      if (!secret) {
        reportError(new Error('JWT_SECRET is missing while resolving setup gate'), {
          source: 'resolveSetupUnlockGate',
        });
      } else {
        const payload = jwt.verify(token, secret) as { setup?: boolean };
        if (payload.setup === true) {
          return { redirect: { destination: safe, permanent: false } };
        }
      }
    } catch {
      // invalid / expired — show unlock form
    }
  }

  return { props: { returnUrl: safe } };
}

/**
 * When `ADMIN_SETUP_PASSWORD` is set, API routes that change site setup data must also receive
 * the `admin_setup_gate` cookie from `POST /api/setup-unlock`.
 */
export function assertSetupGateAllowed(req: NextApiRequest, res: NextApiResponse): boolean {
  const expected = process.env.ADMIN_SETUP_PASSWORD;
  if (!expected || !String(expected).trim()) {
    return true;
  }

  const token = req.cookies[ADMIN_SETUP_GATE_COOKIE];
  if (!token) {
    res.status(403).json({
      message: 'Setup password required. Open /setup-unlock in the admin, or sign in again after configuring ADMIN_SETUP_PASSWORD.',
    });
    return false;
  }

  try {
    const secret = getJwtSecret();
    if (!secret) {
      reportError(new Error('JWT_SECRET is missing while asserting setup gate'), {
        source: 'assertSetupGateAllowed',
      });
      res.status(500).json({ message: 'Server configuration error: JWT_SECRET is missing.' });
      return false;
    }
    const payload = jwt.verify(token, secret) as { setup?: boolean };
    if (payload.setup !== true) {
      throw new Error('Invalid setup gate');
    }
    return true;
  } catch {
    res.status(403).json({ message: 'Setup password expired or invalid. Visit /setup-unlock again.' });
    return false;
  }
}

/**
 * Resolves the Supabase user from API cookies, refreshing the session and setting cookies on `res` when needed.
 */
export async function getAuthUserFromApiRequest(
  req: NextApiRequest,
  res?: NextApiResponse,
): Promise<{ id: string; email?: string } | null> {
  return resolveAdminSession(req.cookies, res);
}

export function verifyAdminSession(
  req: NextApiRequest,
  res?: NextApiResponse,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return getAuthUserFromApiRequest(req, res)
    .then((user) => (user ? ({ ok: true } as const) : ({ ok: false, message: 'Unauthorized' } as const)))
    .catch(() => ({ ok: false, message: 'Unauthorized' } as const));
}

/**
 * Same cookie resolution as `requireAuthentication`, returning the user id for RBAC.
 */
export async function getAuthUserFromGsspContext(
  context: GetServerSidePropsContext,
): Promise<{ id: string; email?: string } | null> {
  const cookies = nookies.get(context);
  return resolveAdminSession(cookies, context);
}

type GsspWithPermissions = (
  context: GetServerSidePropsContext,
  auth: { userId: string; permissions: AppPermissions },
) => Promise<any>;

/**
 * Requires an authenticated session and feature flags. Merges `permissions` into page props.
 * Chain inside `requireAuthentication`: `requireAuthentication(requirePermission({ blogs: true }, gssp))`.
 */
export function requirePermission(
  needs: { blogs?: boolean; tasks?: boolean; users?: boolean; attendance?: boolean; expenses?: boolean },
  gssp: GsspWithPermissions,
) {
  return async (context: GetServerSidePropsContext) => {
    const ctx = await resolveAdminUserContextFromGssp(context);
    if (!ctx) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

    const { permissions, userId, profileLoadError } = ctx;

    if (profileLoadError && !permissions.isPrimaryAdmin) {
      const message = encodeURIComponent(profileLoadError);
      return {
        redirect: {
          destination: `/profile-error?message=${message}`,
          permanent: false,
        },
      };
    }

    if (needs.blogs && !permissions.canManageBlogs) {
      return {
        redirect: {
          destination: redirectWhenBlogDenied(permissions),
          permanent: false,
        },
      };
    }
    if (needs.tasks && !permissions.canManageTasks) {
      return {
        redirect: {
          destination: redirectWhenTaskDenied(permissions),
          permanent: false,
        },
      };
    }
    if (needs.users && !permissions.canAccessUserManagement) {
      return {
        redirect: {
          destination: '/unauthorized',
          permanent: false,
        },
      };
    }
    if (needs.attendance && !permissions.canManageAttendance && !permissions.isPrimaryAdmin) {
      return {
        redirect: {
          destination: '/unauthorized',
          permanent: false,
        },
      };
    }
    if (needs.expenses && !permissions.canManageExpenses && !permissions.isPrimaryAdmin) {
      return {
        redirect: {
          destination: '/unauthorized',
          permanent: false,
        },
      };
    }

    const result = await gssp(context, { userId, permissions });
    if (result && typeof result === 'object' && 'props' in result && result.props && typeof result.props === 'object') {
      return {
        ...result,
        props: {
          ...result.props,
          permissions,
        },
      };
    }
    return result;
  };
}

export function requireAuthentication(gssp: any) {
  return async (context: GetServerSidePropsContext) => {
    const user = await getAuthUserFromGsspContext(context);
    if (!user) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

    return await gssp(context);
  };
}

/**
 * When `ADMIN_SETUP_PASSWORD` is set in the environment, require a second password
 * (verified via `/api/setup-unlock`) before running the inner getServerSideProps.
 * Chain *inside* `requireAuthentication`: `requireAuthentication(requireSetupPassword(gssp))`.
 */
export function requireSetupPassword(
  gssp: (context: GetServerSidePropsContext) => Promise<any>,
) {
  return async (context: GetServerSidePropsContext) => {
    const expected = process.env.ADMIN_SETUP_PASSWORD;
    if (!expected || !String(expected).trim()) {
      return gssp(context);
    }

    const cookies = nookies.get(context);
    const token = cookies[ADMIN_SETUP_GATE_COOKIE];
    if (!token) {
      const dest = `/setup-unlock?returnUrl=${encodeURIComponent(safeReturnPath(context.resolvedUrl))}`;
      return { redirect: { destination: dest, permanent: false } };
    }

    try {
      const secret = getJwtSecret();
      if (!secret) {
        reportError(new Error('JWT_SECRET is missing while requiring setup password'), {
          source: 'requireSetupPassword',
          resolvedUrl: context.resolvedUrl,
        });
        const dest = `/setup-unlock?returnUrl=${encodeURIComponent(safeReturnPath(context.resolvedUrl))}`;
        return { redirect: { destination: dest, permanent: false } };
      }
      const payload = jwt.verify(token, secret) as { setup?: boolean };
      if (payload.setup !== true) {
        throw new Error('Invalid setup gate token');
      }
    } catch {
      const dest = `/setup-unlock?returnUrl=${encodeURIComponent(safeReturnPath(context.resolvedUrl))}`;
      return { redirect: { destination: dest, permanent: false } };
    }

    return gssp(context);
  };
}
