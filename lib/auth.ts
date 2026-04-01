import type { NextApiRequest } from 'next';
import { GetServerSidePropsContext } from 'next';
import nookies from 'nookies';
import jwt from 'jsonwebtoken';

export function verifyAdminSession(
  req: NextApiRequest,
): { ok: true } | { ok: false; message: string } {
  const token = req.cookies.admin_session;
  if (!token) {
    return { ok: false, message: 'Unauthorized' };
  }
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    return { ok: true };
  } catch {
    return { ok: false, message: 'Unauthorized' };
  }
}

export function requireAuthentication(gssp: any) {
  return async (context: GetServerSidePropsContext) => {
    const cookies = nookies.get(context);
    const token = cookies.admin_session;

    if (!token) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      // If valid, continue to page props
      return await gssp(context);
    } catch (err) {
      return {
        redirect: {
          destination: '/login',
          permanent: false,
        },
      };
    }
  };
}
