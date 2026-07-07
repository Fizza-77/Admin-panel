import type { NextApiResponse } from 'next';
import type { GetServerSidePropsContext } from 'next';
import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { ADMIN_REFRESH_COOKIE, ADMIN_SESSION_COOKIE } from '@/lib/auth/cookieNames';
import {
  clearSessionCookiesOnContext,
  clearSessionCookiesOnResponse,
  setSessionCookiesOnContext,
  setSessionCookiesOnResponse,
} from '@/lib/auth/sessionCookies';

export type ResolvedAdminUser = { id: string; email?: string };

type CookieBag = Partial<Record<string, string>>;

function isStaleRefreshError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /invalid refresh token|refresh token not found|already used/i.test(message);
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  const cause = (error as Error & { cause?: { code?: string } }).cause;
  return (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('connect timeout') ||
    cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
    cause?.code === 'ECONNREFUSED' ||
    cause?.code === 'ENOTFOUND'
  );
}

function clearSessionCookies(target: NextApiResponse | GetServerSidePropsContext) {
  if ('setHeader' in target && typeof target.setHeader === 'function') {
    clearSessionCookiesOnResponse(target as NextApiResponse);
  } else {
    clearSessionCookiesOnContext(target as GetServerSidePropsContext);
  }
}

async function safeGetUser(accessToken: string) {
  try {
    return await supabase.auth.getUser(accessToken);
  } catch (error) {
    reportError(error, { source: 'resolveAdminSession.getUser', network: isNetworkError(error) });
    return { data: { user: null }, error: error as Error };
  }
}

async function refreshWithToken(refreshToken: string) {
  try {
    return await supabase.auth.refreshSession({ refresh_token: refreshToken });
  } catch (error) {
    reportError(error, { source: 'resolveAdminSession.refresh', network: isNetworkError(error) });
    return { data: { session: null, user: null }, error: error as Error };
  }
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
    const { data, error } = await safeGetUser(accessToken);
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
    if (!isStaleRefreshError(error) && !isNetworkError(error)) {
      reportError(error, { source: 'resolveAdminSession.refresh' });
    }
    if (writeTarget) {
      clearSessionCookies(writeTarget);
    }
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
