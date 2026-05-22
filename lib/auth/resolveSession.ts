import type { NextApiResponse } from 'next';
import type { GetServerSidePropsContext } from 'next';
import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { ADMIN_REFRESH_COOKIE, ADMIN_SESSION_COOKIE } from '@/lib/auth/cookieNames';
import {
  setSessionCookiesOnContext,
  setSessionCookiesOnResponse,
} from '@/lib/auth/sessionCookies';

export type ResolvedAdminUser = { id: string; email?: string };

type CookieBag = Partial<Record<string, string>>;

async function refreshWithToken(refreshToken: string) {
  return supabase.auth.refreshSession({ refresh_token: refreshToken });
}

/**
 * Validates access token or refreshes using refresh token.
 * Optionally writes rotated cookies (sliding session) to res or GSSP context.
 */
export async function resolveAdminSession(
  cookies: CookieBag,
  writeTarget?: NextApiResponse | GetServerSidePropsContext,
): Promise<ResolvedAdminUser | null> {
  const accessToken = cookies[ADMIN_SESSION_COOKIE];
  const refreshToken = cookies[ADMIN_REFRESH_COOKIE];

  if (!accessToken && !refreshToken) {
    return null;
  }

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data.user) {
      if (writeTarget && refreshToken) {
        applySessionCookies(writeTarget, accessToken, refreshToken);
      }
      return { id: data.user.id, email: data.user.email ?? undefined };
    }
    if (!refreshToken) {
      return null;
    }
  } else if (!refreshToken) {
    return null;
  }

  const { data, error } = await refreshWithToken(refreshToken!);
  if (error) {
    reportError(error, { source: 'resolveAdminSession.refresh' });
  }

  if (error || !data.session?.access_token || !data.session.refresh_token || !data.user) {
    return null;
  }

  if (writeTarget) {
    applySessionCookies(writeTarget, data.session.access_token, data.session.refresh_token);
  }

  return { id: data.user.id, email: data.user.email ?? undefined };
}

function applySessionCookies(
  target: NextApiResponse | GetServerSidePropsContext,
  accessToken: string,
  refreshToken: string,
) {
  if ('setHeader' in target && typeof target.setHeader === 'function') {
    setSessionCookiesOnResponse(target as NextApiResponse, accessToken, refreshToken);
  } else {
    setSessionCookiesOnContext(target as GetServerSidePropsContext, accessToken, refreshToken);
  }
}
