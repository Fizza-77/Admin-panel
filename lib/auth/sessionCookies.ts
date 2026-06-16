import type { NextApiResponse } from 'next';
import type { GetServerSidePropsContext } from 'next';
import { serialize } from 'cookie';
import nookies from 'nookies';
import { ADMIN_REFRESH_COOKIE, ADMIN_SESSION_COOKIE } from '@/lib/auth/cookieNames';

/** Default 30 days — refresh cookie lifetime; access token is renewed via refresh. */
const DEFAULT_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export function getSessionCookieMaxAgeSec(): number {
  const raw = process.env.ADMIN_SESSION_MAX_AGE_DAYS;
  if (!raw?.trim()) {
    return DEFAULT_MAX_AGE_SEC;
  }
  const days = Number.parseInt(raw, 10);
  if (!Number.isFinite(days) || days < 1) {
    return DEFAULT_MAX_AGE_SEC;
  }
  return days * 60 * 60 * 24;
}

function cookieBaseOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: getSessionCookieMaxAgeSec(),
  };
}

export function buildSessionCookieHeader(accessToken: string, refreshToken: string): string[] {
  const opts = cookieBaseOptions();
  return [
    serialize(ADMIN_SESSION_COOKIE, accessToken, opts),
    serialize(ADMIN_REFRESH_COOKIE, refreshToken, opts),
  ];
}

export function setSessionCookiesOnResponse(
  res: NextApiResponse,
  accessToken: string,
  refreshToken: string,
): void {
  res.setHeader('Set-Cookie', buildSessionCookieHeader(accessToken, refreshToken));
}

export function setSessionCookiesOnContext(
  context: GetServerSidePropsContext,
  accessToken: string,
  refreshToken: string,
): void {
  const opts = cookieBaseOptions();
  nookies.set(context, ADMIN_SESSION_COOKIE, accessToken, opts);
  nookies.set(context, ADMIN_REFRESH_COOKIE, refreshToken, opts);
}

export function clearSessionCookieHeaders(): string[] {
  const opts = {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
  return [
    serialize(ADMIN_SESSION_COOKIE, '', opts),
    serialize(ADMIN_REFRESH_COOKIE, '', opts),
  ];
}

export function clearSessionCookiesOnResponse(res: NextApiResponse): void {
  res.setHeader('Set-Cookie', clearSessionCookieHeaders());
}

export function clearSessionCookiesOnContext(context: GetServerSidePropsContext): void {
  const opts = {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
  nookies.destroy(context, ADMIN_SESSION_COOKIE, opts);
  nookies.destroy(context, ADMIN_REFRESH_COOKIE, opts);
}
