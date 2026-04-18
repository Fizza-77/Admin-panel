import type { NextApiRequest, NextApiResponse } from 'next';
import { GetServerSidePropsContext } from 'next';
import nookies from 'nookies';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';

/** HttpOnly cookie set after the user passes ADMIN_SETUP_PASSWORD (site setup actions). */
export const ADMIN_SETUP_GATE_COOKIE = 'admin_setup_gate';
export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_REFRESH_COOKIE = 'admin_refresh_token';

function getAuthSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    reportError(new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for auth client'), {
      source: 'auth.getAuthSupabaseClient',
    });
    return null;
  }

  // Keep auth/session checks isolated from the shared service-role DB client.
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

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

export function verifyAdminSession(
  req: NextApiRequest,
  res?: NextApiResponse,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const accessToken = req.cookies[ADMIN_SESSION_COOKIE];
  const refreshToken = req.cookies[ADMIN_REFRESH_COOKIE];
  const authSupabase = getAuthSupabaseClient();

  const verifyOrRefresh = async () => {
    if (!authSupabase) {
      return { ok: false, message: 'Unauthorized' } as const;
    }

    if (accessToken) {
      const { data, error } = await authSupabase.auth.getUser(accessToken);
      if (!error && data.user) {
        return { ok: true } as const;
      }

      if (!refreshToken) {
        return { ok: false, message: 'Unauthorized' } as const;
      }
    } else if (!refreshToken) {
      return { ok: false, message: 'Unauthorized' } as const;
    }

    const { data, error } = await authSupabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session?.access_token || !data.session.refresh_token) {
      return { ok: false, message: 'Unauthorized' } as const;
    }

    if (res) {
      const secure = process.env.NODE_ENV === 'production';
      res.setHeader('Set-Cookie', [
        serialize(ADMIN_SESSION_COOKIE, data.session.access_token, {
          httpOnly: true,
          secure,
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        }),
        serialize(ADMIN_REFRESH_COOKIE, data.session.refresh_token, {
          httpOnly: true,
          secure,
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        }),
      ]);
    }

    return { ok: true } as const;
  };

  return verifyOrRefresh().catch(() => ({ ok: false, message: 'Unauthorized' } as const));
}

export function requireAuthentication(gssp: any) {
  return async (context: GetServerSidePropsContext) => {
    const cookies = nookies.get(context);
    const token = cookies[ADMIN_SESSION_COOKIE];
    const refreshToken = cookies[ADMIN_REFRESH_COOKIE];
    const authSupabase = getAuthSupabaseClient();

    if (!token && !refreshToken) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

    let isAuthed = false;

    if (token && authSupabase) {
      const { data, error } = await authSupabase.auth.getUser(token);
      isAuthed = !error && Boolean(data.user);
    }

    if (!isAuthed && refreshToken && authSupabase) {
      const { data, error } = await authSupabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (!error && data.session?.access_token && data.session.refresh_token) {
        isAuthed = true;
        nookies.set(context, ADMIN_SESSION_COOKIE, data.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
        nookies.set(context, ADMIN_REFRESH_COOKIE, data.session.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
      }
    }

    if (!isAuthed) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

    // If valid, continue to page props
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
